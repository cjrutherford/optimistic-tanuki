import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import {
  AccountDeletionWriteFenceEntity,
  deletionIdentityKey,
  fencedDeletionTransaction,
  generateDeletionWriteFenceSql,
  installDeletionWriteFence,
} from './account-deletion-write-fence';

const connectionString = process.env['ACCOUNT_DELETION_FENCE_PG_URL'];
const enabled = Boolean(connectionString);
const describePostgres = enabled ? describe : describe.skip;

describePostgres('account deletion write fence against PostgreSQL 16', () => {
  let source: DataSource;
  const ids = {
    account: randomUUID(),
    profile: randomUUID(),
    other: randomUUID(),
    jsonLegacy: 'JsonLegacyExactCase',
    csvLegacy: 'CsvLegacyExactCase',
    drainAccount: randomUUID(),
    mixedAccount: randomUUID(),
    mixedProfile: randomUUID(),
  };
  const operation = randomUUID();
  const policies = [
    {
      table: 'fence_scalar_rows',
      identities: [
        { column: 'account_id', kind: 'account' as const },
        { column: 'profile_id', kind: 'profile' as const },
      ],
    },
    {
      table: 'fence_json_rows',
      identities: [
        {
          column: 'identities',
          kind: 'legacy-profile' as const,
          array: 'json' as const,
        },
      ],
    },
    {
      table: 'fence_csv_rows',
      identities: [
        {
          column: 'identities',
          kind: 'legacy-profile' as const,
          array: 'csv' as const,
        },
      ],
    },
  ];
  const run = async (sql: string, parameters?: unknown[]) =>
    source.query(sql, parameters);

  beforeAll(async () => {
    source = new DataSource({
      type: 'postgres',
      url: connectionString,
      entities: [AccountDeletionWriteFenceEntity],
      synchronize: true,
      extra: {
        statement_timeout: 8000,
        lock_timeout: 4000,
        idle_in_transaction_session_timeout: 10000,
      },
    });
    await source.initialize();
    await source.query(
      "SELECT set_config('statement_timeout','8s',false), set_config('lock_timeout','4s',false)"
    );
    await source.query(
      'CREATE TABLE fence_scalar_rows (id integer PRIMARY KEY, account_id uuid, profile_id uuid)'
    );
    await source.query(
      'CREATE TABLE fence_json_rows (id integer PRIMARY KEY, identities jsonb)'
    );
    await source.query(
      'CREATE TABLE fence_csv_rows (id integer PRIMARY KEY, identities text)'
    );
    await source.query(
      'INSERT INTO fence_scalar_rows VALUES (1,$1,$2),(2,$3,NULL)',
      [ids.account, ids.profile, ids.other]
    );
    await source.query('INSERT INTO fence_json_rows VALUES (1,$1)', [
      JSON.stringify([ids.jsonLegacy, ids.profile]),
    ]);
    await source.query('INSERT INTO fence_csv_rows VALUES (1,$1)', [
      `${ids.csvLegacy},${ids.profile}`,
    ]);
    await source.query('INSERT INTO fence_scalar_rows VALUES (3,$1,NULL)', [
      ids.drainAccount,
    ]);
    const generated = generateDeletionWriteFenceSql(policies);
    for (const sql of generated.up) await source.query(sql);
    (globalThis as any).__deletionFenceDownSql = generated.down;
  }, 30000);

  afterAll(async () => {
    if (source?.isInitialized) {
      try {
        for (const sql of (globalThis as any).__deletionFenceDownSql ?? [])
          await source.query(sql);
        const catalog = await source.query(
          "SELECT count(*)::int AS count FROM pg_trigger WHERE tgname LIKE 'ot_deletion_write_fence_%' AND NOT tgisinternal"
        );
        if (catalog[0].count !== 0)
          throw new Error('ACCOUNT_DELETION_FENCE_TRIGGER_TEARDOWN_FAILED');
        await source.query(
          'DROP TABLE IF EXISTS fence_csv_rows, fence_json_rows, fence_scalar_rows'
        );
      } finally {
        await source.destroy();
      }
    }
  }, 30000);

  it('matches canonical hashes and fences identities across scalar, JSON, and CSV writes', async () => {
    const pg = await run(
      "SELECT ot_deletion_fence_key($1,'account') AS account, ot_deletion_fence_key($2,'legacy-profile') AS json_legacy, ot_deletion_fence_key($3,'legacy-profile') AS csv_legacy",
      [ids.account.toUpperCase(), ids.jsonLegacy, ids.csvLegacy]
    );
    expect(pg[0].account).toBe(deletionIdentityKey('account', ids.account));
    expect(pg[0].json_legacy).toBe(
      deletionIdentityKey('legacy-profile', ids.jsonLegacy)
    );
    expect(pg[0].csv_legacy).toBe(
      deletionIdentityKey('legacy-profile', ids.csvLegacy)
    );
    await source.transaction(async (manager) =>
      installDeletionWriteFence(manager, operation, [
        { kind: 'account', id: ids.account },
        { kind: 'profile', id: ids.profile },
        { kind: 'legacy-profile', id: ids.jsonLegacy },
        { kind: 'legacy-profile', id: ids.csvLegacy },
      ])
    );
    await expect(
      run('UPDATE fence_scalar_rows SET account_id=$1 WHERE id=1', [
        randomUUID(),
      ])
    ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
    await expect(
      run('UPDATE fence_scalar_rows SET account_id=$1 WHERE id=2', [
        ids.account,
      ])
    ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
    await expect(
      run('DELETE FROM fence_scalar_rows WHERE id=1')
    ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
    await expect(
      run('UPDATE fence_scalar_rows SET account_id=$1 WHERE id=1', [
        randomUUID(),
      ])
    ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
    await expect(
      run('UPDATE fence_json_rows SET identities=$1 WHERE id=1', ['[]'])
    ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
    await expect(
      run('UPDATE fence_csv_rows SET identities=$1 WHERE id=1', ['unrelated'])
    ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
    await run('UPDATE fence_scalar_rows SET account_id=$1 WHERE id=2', [
      randomUUID(),
    ]);
    await fencedDeletionTransaction(source, operation, (manager) =>
      manager.query('UPDATE fence_scalar_rows SET account_id=NULL WHERE id=1')
    );
    await expect(
      fencedDeletionTransaction(source, randomUUID(), (manager) =>
        manager.query('DELETE FROM fence_scalar_rows WHERE id=1')
      )
    ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
  });

  it('allows a trusted participant operation to clear only its identity from a mixed fenced audit row', async () => {
    const operationA = randomUUID();
    const operationB = randomUUID();
    const operationC = randomUUID();
    await run('INSERT INTO fence_scalar_rows VALUES (5,$1,$2)', [
      ids.mixedAccount,
      ids.mixedProfile,
    ]);
    await source.transaction((manager) =>
      installDeletionWriteFence(manager, operationA, [
        { kind: 'account', id: ids.mixedAccount },
      ])
    );
    await source.transaction((manager) =>
      installDeletionWriteFence(manager, operationB, [
        { kind: 'profile', id: ids.mixedProfile },
      ])
    );

    await expect(
      source.query('UPDATE fence_scalar_rows SET account_id=NULL WHERE id=5')
    ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
    await fencedDeletionTransaction(source, operationA, (manager) =>
      manager.query('UPDATE fence_scalar_rows SET account_id=NULL WHERE id=5')
    );
    const afterA = await run(
      'SELECT account_id, profile_id FROM fence_scalar_rows WHERE id=5'
    );
    expect(afterA[0].account_id).toBeNull();
    expect(afterA[0].profile_id).toBe(ids.mixedProfile);
    await expect(
      fencedDeletionTransaction(source, operationC, (manager) =>
        manager.query('UPDATE fence_scalar_rows SET profile_id=NULL WHERE id=5')
      )
    ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
    await fencedDeletionTransaction(source, operationB, (manager) =>
      manager.query('UPDATE fence_scalar_rows SET profile_id=NULL WHERE id=5')
    );
    await expect(
      source.query('UPDATE fence_scalar_rows SET account_id=$1 WHERE id=5', [
        ids.mixedAccount,
      ])
    ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
  });

  it('waits for an in-flight writer before acknowledging installation; retries are idempotent and ownership conflicts fail', async () => {
    const blocker = source.createQueryRunner();
    await blocker.connect();
    await blocker.startTransaction();
    try {
      await blocker.query(
        'UPDATE fence_scalar_rows SET account_id=account_id WHERE id=3'
      );
      let ack = false;
      const installing = source
        .transaction((manager) =>
          installDeletionWriteFence(manager, operation, [
            { kind: 'account', id: ids.drainAccount },
          ])
        )
        .then(() => {
          ack = true;
        });
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(ack).toBe(false);
      await blocker.commitTransaction();
      await blocker.release();
      await installing;
      expect(ack).toBe(true);
      await source.transaction((manager) =>
        installDeletionWriteFence(manager, operation, [
          { kind: 'account', id: ids.drainAccount },
        ])
      );
      await expect(
        source.transaction((manager) =>
          installDeletionWriteFence(manager, randomUUID(), [
            { kind: 'account', id: ids.drainAccount },
          ])
        )
      ).rejects.toThrow('DELETION_WRITE_FENCE_OWNERSHIP_CONFLICT');
      const rows = await run(
        'SELECT count(*)::int AS count FROM account_deletion_write_fence WHERE key=$1',
        [deletionIdentityKey('account', ids.drainAccount)]
      );
      expect(rows[0].count).toBe(1);
    } finally {
      if (!blocker.isReleased) {
        if (blocker.isTransactionActive) await blocker.rollbackTransaction();
        await blocker.release();
      }
    }
  });

  it('runs generated down SQL to remove triggers and functions', async () => {
    const down = (globalThis as any).__deletionFenceDownSql as string[];
    for (const sql of down) await run(sql);
    const triggers = await run(
      "SELECT count(*)::int AS count FROM pg_trigger WHERE tgname LIKE 'ot_deletion_write_fence_%' AND NOT tgisinternal"
    );
    expect(triggers[0].count).toBe(0);
    const funcs = await run(
      "SELECT count(*)::int AS count FROM pg_proc WHERE proname IN ('ot_deletion_fence_key','ot_collect_deletion_fence_keys','ot_account_deletion_write_fence_guard')"
    );
    expect(funcs[0].count).toBe(0);
  });
});
