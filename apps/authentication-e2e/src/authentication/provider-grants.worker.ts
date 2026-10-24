/** Private, disposable-database N07 proof. No external provider requests. */
import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import loadDatabase from '../../../authentication/src/app/loadDatabase';
import { OAuthService } from '../../../authentication/src/app/oauth.service';
import { TokenEntity } from '../../../authentication/src/tokens/entities/token.entity';
import { UserEntity } from '../../../authentication/src/user/entities/user.entity';
import { OAuthProviderEntity } from '../../../authentication/src/oauth-providers/entities/oauth-provider.entity';

async function run() {
  if (process.env['OT_N07_PRIVATE_FIXTURE'] !== '1')
    throw new Error('PRIVATE_FIXTURE_REQUIRED');
  const port = Number(process.env['OT_N07_PRIVATE_PORT']);
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535)
    throw new Error('PRIVATE_PORT_REQUIRED');
  const config = new ConfigService({
    database: {
      host: '127.0.0.1',
      port,
      username: 'postgres',
      password: '',
      database: 'postgres',
    },
  });
  const ds = new DataSource({
    ...loadDatabase(config),
    synchronize: false,
    migrationsRun: false,
  });
  await ds.initialize();
  await ds.runMigrations();
  const counts = async () => {
    const tables: { tablename: string }[] = await ds.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
    );
    const result: Record<string, number> = {};
    for (const { tablename } of tables) {
      if (!/^[a-zA-Z0-9_]+$/.test(tablename)) throw new Error('UNSAFE_TABLE');
      result[tablename] = Number(
        (await ds.query(`SELECT count(*)::text AS n FROM "${tablename}"`))[0].n
      );
    }
    return result;
  };
  const before = await counts();
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  const users = ds.getRepository(UserEntity);
  const providers = ds.getRepository(OAuthProviderEntity);
  const service = () =>
    new OAuthService(
      new Logger('N07Private'),
      providers,
      users,
      ds.getRepository(TokenEntity),
      'unused-private-fixture',
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );
  const assert = (condition: unknown, code: string) => {
    if (!condition) throw new Error(code);
  };
  let triggerInstalled = false;
  let primaryError: unknown;
  let restored = false;
  let restartClean = false;
  try {
    for (const [index, id] of ids.entries())
      await users.save(
        users.create({
          id,
          email: `n07-${id}@example.test`,
          firstName: 'N07',
          lastName: 'Fixture',
          bio: '',
          password: index === 0 ? '' : 'private-fixture-password-hash',
        })
      );
    const make = (userId: string, provider: string) =>
      providers.save(
        providers.create({
          userId,
          provider,
          providerUserId: randomUUID(),
          providerEmail: 'private-fixture@example.test',
        })
      );
    await Promise.all([
      make(ids[0], 'github'),
      make(ids[0], 'google'),
      make(ids[1], 'github'),
      make(ids[2], 'github'),
    ]);
    const outcomes = await Promise.allSettled([
      service().unlinkProvider(ids[0], 'github'),
      service().unlinkProvider(ids[0], 'google'),
    ]);
    assert(
      outcomes.filter((result) => result.status === 'fulfilled').length === 1,
      'CONCURRENT_LAST_METHOD_GUARD'
    );
    assert(
      (await providers.count({ where: { userId: ids[0] } })) === 1,
      'EXACTLY_ONE_METHOD_REMAINS'
    );
    assert(
      (await providers.count({ where: { userId: ids[1] } })) === 1,
      'COUNTERPART_PRESERVED'
    );
    await ds.query(
      `CREATE FUNCTION ot_n07_delete_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD."userId" = '${ids[2]}' THEN RAISE EXCEPTION 'N07_INJECTED_DELETE_FAILURE'; END IF; RETURN OLD; END $$`
    );
    await ds.query(
      'CREATE TRIGGER ot_n07_delete_fault BEFORE DELETE ON oauth_provider FOR EACH ROW EXECUTE FUNCTION ot_n07_delete_fault()'
    );
    triggerInstalled = true;
    let failed = false;
    try {
      await service().unlinkProvider(ids[2], 'github');
    } catch {
      failed = true;
    }
    assert(
      failed && (await providers.count({ where: { userId: ids[2] } })) === 1,
      'FAILED_DELETE_ROLLS_BACK'
    );
    await ds.query('DROP TRIGGER ot_n07_delete_fault ON oauth_provider');
    await ds.query('DROP FUNCTION ot_n07_delete_fault()');
    triggerInstalled = false;
    await service().unlinkProvider(ids[2], 'github');
    assert(
      (await providers.count({ where: { userId: ids[2] } })) === 0,
      'RETRY_REMOVES_LOCAL_LINKAGE'
    );
    const columns = ds
      .getMetadata(OAuthProviderEntity)
      .columns.map((column) => column.databaseName);
    assert(
      !columns.some((name) =>
        /access.?token|refresh.?token|id.?token/i.test(name)
      ),
      'NO_PROVIDER_TOKEN_COLUMN'
    );
  } catch (error) {
    primaryError = error;
  } finally {
    if (triggerInstalled) {
      await ds.query(
        'DROP TRIGGER IF EXISTS ot_n07_delete_fault ON oauth_provider'
      );
      await ds.query('DROP FUNCTION IF EXISTS ot_n07_delete_fault()');
    }
    for (const id of ids) await users.delete({ id });
    const after = await counts();
    restored = JSON.stringify(before) === JSON.stringify(after);
    await ds.destroy();
    await ds.initialize();
    restartClean =
      (await ds
        .getRepository(OAuthProviderEntity)
        .count({ where: ids.map((userId) => ({ userId })) })) === 0;
    await ds.destroy();
    const report = {
      status: !primaryError && restored && restartClean ? 'PASS' : 'FAIL',
      realPostgres: true,
      concurrentUnlink: !primaryError,
      countsBefore: before,
      countsAfter: after,
      restored,
      restartClean,
      externalProviderRequests: 0,
      limits: [
        'Direct OAuthService with real transaction repositories; no Gateway or external provider handshake',
        'Unused sign-in DI dependencies are inert fixtures; only unlink is exercised',
      ],
    };
    await writeFile(
      process.env['OT_N07_REPORT'] || '/tmp/ot-n07-report.json',
      JSON.stringify(report, null, 2)
    );
  }
  if (primaryError) throw primaryError;
  assert(restored && restartClean, 'FIXTURE_READBACK_MISMATCH');
}
run().catch(() => {
  process.stderr.write('N07_PRIVATE_FIXTURE_FAILED\n');
  process.exitCode = 1;
});
