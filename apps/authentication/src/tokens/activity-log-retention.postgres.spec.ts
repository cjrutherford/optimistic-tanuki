import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import {
  ActivityRetentionService,
  ActivityRetentionRule,
  AuditErasureRunner,
} from '@optimistic-tanuki/logger';
import { deletionIdentityKey } from '@optimistic-tanuki/storage';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
const enabled = process.env['R2_PRIVATE_FIXTURE'] === 'r2-session-private';
const policy: Record<string, ActivityRetentionRule[]> = {
  profile: [
    {
      table: 'guardian_profile_activity',
      timeColumn: 'createdAt',
      timestampWithZone: true,
    },
  ],
  assets: [
    {
      table: 'guardian_asset_activity',
      timeColumn: 'createdAt',
      timestampWithZone: true,
    },
  ],
  social: [
    'activity',
    'search_history',
    'community_membership_audit',
    'content_moderation_action',
    'guardian_content_audit',
  ]
    .map((table) => ({
      table,
      timeColumn: 'createdAt',
      timestampWithZone: false,
    }))
    .concat([
      {
        table: 'profile_view',
        timeColumn: 'viewedAt',
        timestampWithZone: false,
      },
    ]),
  forum: [
    {
      table: 'forum_moderation_action',
      timeColumn: 'createdAt',
      timestampWithZone: false,
    },
  ],
};
(enabled ? describe : describe.skip)(
  'R2 ninety-day physical log retention',
  () => {
    const dbs = new Map<string, DataSource>();
    const cutoff = '2000-01-01T00:00:00.123456Z';
    beforeAll(async () => {
      if (
        process.env['POSTGRES_HOST'] !== '127.0.0.1' ||
        process.env['POSTGRES_DB'] !== 'r2_authentication'
      )
        throw Error('R2_PRIVATE_DATABASE_REQUIRED');
      for (const owner of Object.keys(policy))
        dbs.set(
          owner,
          await new DataSource({
            type: 'postgres',
            host: '127.0.0.1',
            port: Number(process.env['POSTGRES_PORT']),
            database: 'r2_' + owner,
            username: 'd00',
            password: process.env['POSTGRES_PASSWORD'],
            synchronize: false,
            migrationsRun: false,
            extra: { statement_timeout: 5000, lock_timeout: 1000 },
          }).initialize()
        );
    });
    afterAll(async () => {
      for (const db of dbs.values()) if (db.isInitialized) await db.destroy();
    });
    async function seed(
      db: DataSource,
      rule: ActivityRetentionRule,
      when: string,
      identity?: string
    ) {
      const cols = await db.query(
        "SELECT column_name,is_nullable,column_default,data_type,udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
        [rule.table]
      );
      const time = cols.find((c: any) => c.column_name === rule.timeColumn);
      expect(time.data_type).toBe(
        rule.timestampWithZone
          ? 'timestamp with time zone'
          : 'timestamp without time zone'
      );
      const values: Record<string, unknown> = { id: randomUUID() };
      for (const c of cols) {
        const key = c.column_name;
        if (
          key === 'id' ||
          key === rule.timeColumn ||
          c.is_nullable === 'YES' ||
          c.column_default !== null
        )
          continue;
        if (c.data_type === 'USER-DEFINED')
          values[key] = (
            await db.query(
              'SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid=enumtypid WHERE typname=$1 ORDER BY enumsortorder LIMIT 1',
              [c.udt_name]
            )
          )[0].enumlabel;
        else if (c.data_type === 'uuid') values[key] = randomUUID();
        else if (c.data_type === 'jsonb')
          values[key] = JSON.stringify(key === 'details' ? {} : []);
        else if (c.data_type === 'ARRAY') values[key] = [];
        else if (c.data_type === 'boolean') values[key] = false;
        else if (
          ['integer', 'bigint', 'numeric', 'double precision'].includes(
            c.data_type
          )
        )
          values[key] = 0;
        else values[key] = 'retention-private';
      }
      if (identity) values['actorUserId'] = identity;
      const keys = Object.keys(values);
      const cast = rule.timestampWithZone
        ? '$' + (keys.length + 1) + '::timestamptz'
        : '($' + (keys.length + 1) + "::timestamptz AT TIME ZONE 'UTC')";
      await db.query(
        `INSERT INTO "${rule.table}" (${keys
          .map((k) => '"' + k + '"')
          .join(',')},"${rule.timeColumn}") VALUES(${keys
          .map((_, i) => '$' + (i + 1))
          .join(',')},${cast})`,
        [...Object.values(values), when]
      );
      return values.id as string;
    }
    it('removes exact and older cutoffs in all nine physical sources, including redacted history', async () => {
      let sources = 0;
      for (const [owner, rules] of Object.entries(policy)) {
        const db = dbs.get(owner)!;
        for (const rule of rules) {
          const older = await seed(db, rule, '2000-01-01T00:00:00.123455Z');
          const exact = await seed(db, rule, cutoff);
          const newer = await seed(db, rule, '2000-01-01T00:00:00.123457Z');
          const runner = new ActivityRetentionService(owner, db, [rule]);
          const report = await runner.sweep(cutoff);
          expect(report.state).toBe('verified');
          expect(report.sources[0]).toMatchObject({ deleted: 2, remaining: 0 });
          const rows = await db.query(
            `SELECT id FROM "${rule.table}" ORDER BY id`
          );
          expect(rows.map((v: any) => v.id)).toEqual([newer]);
          expect(rows.some((v: any) => v.id === older || v.id === exact)).toBe(
            false
          );
          await runner.sweep();
          expect(
            (await db.query(`SELECT count(*) n FROM "${rule.table}"`))[0].n
          ).toBe('0');
          sources++;
        }
      }
      expect(sources).toBe(9);
    });
    it('reports a real delete failure and retries without deleting recent counterpart history', async () => {
      const db = dbs.get('forum')!,
        rule = policy.forum[0];
      const old = await seed(db, rule, cutoff);
      const recent = await seed(db, rule, new Date().toISOString());
      await db.query(
        "CREATE FUNCTION r2_fail_log_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'R2_PRIVATE_DELETE_FAILURE'; END $$"
      );
      await db.query(
        'CREATE TRIGGER r2_fail_log_delete BEFORE DELETE ON forum_moderation_action FOR EACH ROW EXECUTE FUNCTION r2_fail_log_delete()'
      );
      const runner = new ActivityRetentionService('forum', db, [rule]);
      expect((await runner.sweep()).state).toBe('blocked');
      expect(
        (
          await db.query(
            'SELECT count(*) n FROM forum_moderation_action WHERE id=$1',
            [old]
          )
        )[0].n
      ).toBe('1');
      await db.query(
        'DROP TRIGGER r2_fail_log_delete ON forum_moderation_action'
      );
      await db.query('DROP FUNCTION r2_fail_log_delete()');
      expect((await runner.sweep()).state).toBe('verified');
      expect(
        (await db.query('SELECT id FROM forum_moderation_action')).map(
          (v: any) => v.id
        )
      ).toEqual([recent]);
    });
    it('respects a permanent deletion fence, then ages out the approved deidentified history', async () => {
      const db = dbs.get('profile')!,
        rule = policy.profile[0],
        account = randomUUID(),
        operation = randomUUID();
      const id = await seed(db, rule, cutoff, account);
      await db.query(
        `INSERT INTO account_deletion_write_fence("key",kind,"operationId") VALUES($1,'account',$2)`,
        [deletionIdentityKey('account', account), operation]
      );
      const runner = new ActivityRetentionService('profile', db, [rule]);
      expect((await runner.sweep()).state).toBe('blocked');
      await new AuditErasureRunner(db).erase(
        { accountId: account, profileIds: [] },
        [
          {
            table: rule.table,
            accountColumns: ['actorUserId', 'dependentUserId'],
            profileColumns: ['profileId'],
            clearColumns: { changedFieldNames: 'text-array' },
          },
        ],
        async (tx) => {
          await tx.query("SELECT set_config('ot.deletion_operation',$1,true)", [
            operation,
          ]);
        }
      );
      expect((await runner.sweep()).state).toBe('verified');
      expect(
        await db.query('SELECT id FROM guardian_profile_activity WHERE id=$1', [
          id,
        ])
      ).toEqual([]);
      await expect(seed(db, rule, cutoff, account)).rejects.toThrow(
        'ACCOUNT_DELETION_FENCED'
      );
    });
  }
);
