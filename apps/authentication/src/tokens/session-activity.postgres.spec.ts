import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { assertRollingSession } from './session-activity';
import { deletionIdentityKey } from '@optimistic-tanuki/storage';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
const enabled = process.env['R2_PRIVATE_FIXTURE'] === 'r2-session-private';
(enabled ? describe : describe.skip)(
  'R2-01 migrated PostgreSQL idle clock',
  () => {
    let db: DataSource;
    let peer: DataSource;
    let user: string;
    let counterpart: string;
    beforeAll(async () => {
      if (
        process.env['POSTGRES_HOST'] !== '127.0.0.1' ||
        process.env['POSTGRES_DB'] !== 'r2_authentication' ||
        process.env['POSTGRES_USER'] !== 'd00'
      )
        throw Error('R2_PRIVATE_DATABASE_REQUIRED');
      const options = {
        type: 'postgres' as const,
        host: '127.0.0.1',
        port: Number(process.env['POSTGRES_PORT']),
        database: 'r2_authentication',
        username: 'd00',
        password: process.env['POSTGRES_PASSWORD'],
        synchronize: false,
        migrationsRun: false,
        extra: { statement_timeout: 5000, lock_timeout: 3000 },
      };
      db = await new DataSource(options).initialize();
      peer = await new DataSource(options).initialize();
      user = randomUUID();
      counterpart = randomUUID();
      for (const id of [user, counterpart])
        await db.query(
          "INSERT INTO user_entity(id,email,\"firstName\",\"lastName\",password,bio,\"ageEligibilityStatus\") VALUES($1,$2,'Private','Fixture','not-login','','adult')",
          [id, id + '@example.test']
        );
    });
    afterAll(async () => {
      if (peer?.isInitialized) await peer.destroy();
      if (db?.isInitialized) await db.destroy();
    });
    async function seed(age: string | null, iatAgeDays = 0, account = user) {
      const id = randomUUID(),
        profileId = randomUUID();
      await db.query(
        'INSERT INTO token(id,"tokenData","userId","profileId","lastActivityAt") VALUES($1,$2,$3,$4,' +
          (age ? `clock_timestamp()-interval '${age}'` : 'NULL') +
          ')',
        [id, randomUUID(), account, profileId]
      );
      const now = Number(
        (await db.query('SELECT extract(epoch from clock_timestamp()) n'))[0].n
      );
      return {
        id,
        payload: {
          userId: account,
          profileId,
          iat: Math.floor(now - iatAgeDays * 86400),
        },
      };
    }
    it('retains nullable schema without backfill and expires at seven idle days', async () => {
      const column = (
        await db.query(
          "SELECT is_nullable,column_default FROM information_schema.columns WHERE table_name='token' AND column_name='lastActivityAt'"
        )
      )[0];
      expect(column).toEqual({ is_nullable: 'YES', column_default: null });
      for (const age of ['7 days', '7 days 1 second']) {
        const t = await seed(age);
        await expect(
          assertRollingSession(db, t.id, t.payload, true)
        ).rejects.toThrow('SESSION_IDLE_EXPIRED');
      }
      const inside = await seed('6 days 23 hours 59 minutes 59 seconds');
      await expect(
        assertRollingSession(peer, inside.id, inside.payload, false)
      ).resolves.toEqual(expect.any(String));
      const ancient = await seed(null, 100);
      await expect(
        assertRollingSession(db, ancient.id, ancient.payload, true)
      ).rejects.toThrow('SESSION_IDLE_EXPIRED');
    });
    it('has no absolute lifetime and internal validation does not refresh activity', async () => {
      const t = await seed('6 days', 100);
      const before = (
        await db.query('SELECT "lastActivityAt" FROM token WHERE id=$1', [t.id])
      )[0].lastActivityAt;
      await assertRollingSession(peer, t.id, t.payload, false);
      expect(
        (
          await db.query('SELECT "lastActivityAt" FROM token WHERE id=$1', [
            t.id,
          ])
        )[0].lastActivityAt
      ).toEqual(before);
      const expires = await assertRollingSession(peer, t.id, t.payload, true);
      expect(new Date(expires).getTime()).toBeGreaterThan(
        before.getTime() + 7 * 86400000
      );
      const after = (
        await db.query('SELECT "lastActivityAt" FROM token WHERE id=$1', [t.id])
      )[0].lastActivityAt;
      expect(after.getTime()).toBeGreaterThan(before.getTime());
      await Promise.all([
        assertRollingSession(db, t.id, t.payload, true),
        assertRollingSession(peer, t.id, t.payload, true),
      ]);
    });
    it('denies revoked and mismatched rows across connections without touching a counterpart', async () => {
      const t = await seed('1 day');
      const foreign = await seed('1 day', 0, counterpart);
      await peer.query('UPDATE token SET revoked=true WHERE id=$1', [t.id]);
      await expect(
        assertRollingSession(db, t.id, t.payload, true)
      ).rejects.toThrow();
      await expect(
        assertRollingSession(db, foreign.id, t.payload, true)
      ).rejects.toThrow();
      await expect(
        assertRollingSession(peer, foreign.id, foreign.payload, false)
      ).resolves.toEqual(expect.any(String));
    });
    it('cannot refresh a token after a permanent account fence is installed', async () => {
      const t = await seed('1 day');
      const before = (
        await db.query('SELECT "lastActivityAt" FROM token WHERE id=$1', [t.id])
      )[0].lastActivityAt;
      await peer.query(
        `INSERT INTO account_deletion_write_fence("key","kind","operationId") VALUES($1,'account',$2)`,
        [deletionIdentityKey('account', user), randomUUID()]
      );
      await expect(
        assertRollingSession(db, t.id, t.payload, true)
      ).rejects.toThrow();
      await expect(
        assertRollingSession(peer, t.id, t.payload, false)
      ).rejects.toThrow();
      expect(
        (
          await db.query('SELECT "lastActivityAt" FROM token WHERE id=$1', [
            t.id,
          ])
        )[0].lastActivityAt
      ).toEqual(before);
    });
  }
);
