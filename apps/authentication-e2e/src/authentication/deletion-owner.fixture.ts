/** Private synthetic fixtures only; no schema creation, migration execution, or shared-stack access. */
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { Test } from '@nestjs/testing';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { DataSource, DataSourceOptions } from 'typeorm';
import { firstValueFrom, timeout } from 'rxjs';
import {
  ACCOUNT_DELETION_OWNERS,
  AccountDeletionOwner,
} from '@optimistic-tanuki/models';
import { AccountDeletionAuthorityClient } from '@optimistic-tanuki/storage';
import { AccountDeletionAuthorityService } from '../../../authentication/src/account-deletion/account-deletion-authority.service';
import { AccountDeletionOperationEntity } from '../../../authentication/src/account-deletion/account-deletion-operation.entity';
import { AccountDeletionController } from '../../../authentication/src/account-deletion/account-deletion.controller';
import { AppService } from '../../../authentication/src/app/app.service';
export class DeletionOwnerFixture {
  readonly account = randomUUID();
  readonly profile = randomUUID();
  readonly profile2 = randomUUID();
  readonly other = randomUUID();
  readonly otherProfile = randomUUID();
  db!: DataSource;
  authDb!: DataSource;
  authority!: AccountDeletionAuthorityService;
  operation = '';
  private apps: any[] = [];
  private clients: any[] = [];
  private oldKey = process.env['ACCOUNT_DELETION_PROOF_KEY'];
  async serve(controllers: any[], providers: any[]) {
    const server = createServer();
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as any).port;
    await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
    const module = await Test.createTestingModule({
      controllers,
      providers,
    }).compile();
    const app = module.createNestMicroservice({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port },
      logger: false,
    });
    await app.listen();
    this.apps.push(app);
    const client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port },
    });
    this.clients.push(client);
    return client;
  }
  async start(
    database: 'd11_chat' | 'd16_classifieds' | 'd17_payments',
    options: DataSourceOptions
  ) {
    if (
      process.env['D00_PRIVATE_FIXTURE'] !== 'd00-private-fixture' ||
      process.env['POSTGRES_HOST'] !== '127.0.0.1' ||
      process.env['POSTGRES_USER'] !== 'd00'
    )
      throw Error('PRIVATE_FIXTURE_REQUIRED');
    process.env['ACCOUNT_DELETION_PROOF_KEY'] =
      randomBytes(48).toString('base64url');
    const common = {
      type: 'postgres' as const,
      host: '127.0.0.1',
      port: Number(process.env['POSTGRES_PORT']),
      username: 'd00',
      password: process.env['POSTGRES_PASSWORD'],
      synchronize: false,
      migrationsRun: false,
      logging: false,
      extra: { statement_timeout: 15000, lock_timeout: 5000 },
    };
    this.db = new DataSource({
      ...options,
      ...common,
      database,
    } as DataSourceOptions);
    this.authDb = new DataSource({
      ...common,
      database: 'd00',
      entities: [AccountDeletionOperationEntity],
    });
    await this.db.initialize();
    await this.authDb.initialize();
    for (const db of [this.db, this.authDb])
      for (const t of await db.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'migrations'"
      ))
        expect(
          (await db.query(`SELECT count(*)::text n FROM "${t.tablename}"`))[0].n
        ).toBe('0');
    this.authority = new AccountDeletionAuthorityService(
      this.authDb.getRepository(AccountDeletionOperationEntity),
      this.authDb
    );
    const auth = await this.serve(
      [AccountDeletionController],
      [
        { provide: AccountDeletionAuthorityService, useValue: this.authority },
        {
          provide: AppService,
          useValue: {
            validateToken: () => {
              throw Error('SESSION_NOT_ALLOWED');
            },
          },
        },
      ]
    );
    this.operation = (
      await this.authority.accept(this.account, 'local-hub', randomUUID())
    ).id;
    await this.authority.claim(this.operation);
    await this.authority.recordProfileScope(
      await this.authority.issueGrant(this.operation, 'profile', 'fence'),
      {
        currentProfileIds: [this.profile, this.profile2].sort(),
        legacyProfileIds: [],
      }
    );
    return new AccountDeletionAuthorityClient(auth);
  }
  call(client: any, cmd: string, data: unknown): Promise<any> {
    return firstValueFrom(client.send({ cmd }, data).pipe(timeout(20000)));
  }
  async allFencePremises() {
    await this.authDb.query(
      'UPDATE account_deletion_operations SET "ownerProgress"=$2::jsonb WHERE id=$1',
      [
        this.operation,
        JSON.stringify(
          Object.fromEntries(
            ACCOUNT_DELETION_OWNERS.map((o) => [o, { fence: true }])
          )
        ),
      ]
    );
  }
  grant(owner: AccountDeletionOwner, action: 'fence' | 'erase' | 'readback') {
    return this.authority.issueGrant(this.operation, owner, action);
  }
  async seed(table: string, values: Record<string, unknown>) {
    if (
      !/^[a-z_]+$/.test(table) ||
      Object.keys(values).some((k) => !/^\w+$/.test(k))
    )
      throw Error('FIXTURE_IDENTIFIER');
    const keys = Object.keys(values);
    return (
      await this.db.query(
        `INSERT INTO "${table}" (${keys
          .map((k) => '"' + k + '"')
          .join(',')}) VALUES(${keys
          .map((_, i) => '$' + (i + 1))
          .join(',')}) RETURNING id`,
        Object.values(values)
      )
    )[0].id as string;
  }
  async close() {
    try {
      if (this.db?.isInitialized)
        await this.db.transaction(async (m) => {
          await m.query("SELECT set_config('ot.deletion_operation',$1,true)", [
            this.operation,
          ]);
          const tables = await m.query(
            "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'migrations'"
          );
          for (const t of tables)
            if (!/^[a-z_]+$/.test(t.tablename))
              throw Error('FIXTURE_IDENTIFIER');
          if (tables.length)
            await m.query(
              'TRUNCATE ' +
                tables.map((t) => '"' + t.tablename + '"').join(',') +
                ' CASCADE'
            );
        });
      if (this.authDb?.isInitialized) {
        await this.authDb.query(
          'DELETE FROM account_deletion_write_fence WHERE "operationId"=$1',
          [this.operation]
        );
        await this.authDb.query(
          'DELETE FROM account_deletion_operations WHERE id=$1',
          [this.operation]
        );
      }
    } finally {
      for (const c of this.clients) c.close();
      for (const a of this.apps.reverse()) await a.close();
      if (this.db?.isInitialized) await this.db.destroy();
      if (this.authDb?.isInitialized) await this.authDb.destroy();
      if (this.oldKey === undefined)
        delete process.env['ACCOUNT_DELETION_PROOF_KEY'];
      else process.env['ACCOUNT_DELETION_PROOF_KEY'] = this.oldKey;
    }
  }
}
