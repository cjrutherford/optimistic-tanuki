import { createHash } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import {
  deletionIdentityKey,
  fencedDeletionTransaction,
  generateDeletionWriteFenceSql,
  installDeletionWriteFence,
} from './account-deletion-write-fence';

const account = '01234567-89ab-4cde-8fab-0123456789ab';
const operation = '11234567-89ab-4cde-8fab-0123456789ab';

describe('account deletion write fence foundation', () => {
  it('hashes canonical identities without storing raw identity values', () => {
    const expected = createHash('sha256')
      .update(`ot-account-deletion-v1:account:${account}`)
      .digest('hex');
    expect(deletionIdentityKey('account', account.toUpperCase())).toBe(
      expected
    );
    expect(deletionIdentityKey('legacy-profile', 'CaseSensitive')).not.toBe(
      deletionIdentityKey('legacy-profile', 'casesensitive')
    );
    expect(deletionIdentityKey('legacy-profile', account.toUpperCase())).toBe(
      deletionIdentityKey('legacy-profile', account)
    );
    expect(() =>
      deletionIdentityKey('account', '00000000-0000-0000-0000-000000000000')
    ).toThrow();
    expect(() => deletionIdentityKey('legacy-profile', ' padded')).toThrow();
  });

  it('rejects unsafe SQL identifiers and emits OLD and NEW guarding with sorted locks', () => {
    expect(() =>
      generateDeletionWriteFenceSql([
        {
          table: 'users; DROP TABLE x',
          identities: [{ column: 'id', kind: 'account' }],
        },
      ])
    ).toThrow('DELETION_SQL_IDENTIFIER_INVALID');
    const sql = generateDeletionWriteFenceSql([
      {
        table: 'users',
        identities: [
          { column: 'account_id', kind: 'account' },
          { column: 'profile_ids', kind: 'profile', array: 'json' },
        ],
      },
    ]);
    expect(sql.up[0]).toContain("TG_OP <> 'INSERT'");
    expect(sql.up[0]).toContain("TG_OP <> 'DELETE'");
    expect(sql.up[0]).toContain('array_agg(DISTINCT x ORDER BY x)');
    expect(sql.up[0]).toContain('ACCOUNT_DELETION_FENCED');
    expect(sql.up[0]).toContain('op = ANY(fenced_ops)');
    expect(sql.up[0]).toContain('op IS NULL');
    expect(sql.up[0]).toContain("sha256(convert_to('ot-account-deletion-v1:'");
    expect(sql.up[0]).not.toContain('CREATE EXTENSION');
    expect(sql.down.join('\n')).toContain('DROP TRIGGER');
    expect(sql.down.join('\n')).not.toContain('DROP TABLE');
  });

  it('locks in sorted order, inserts idempotently, and rejects foreign ownership', async () => {
    const calls: Array<{ sql: string; parameters?: unknown[] }> = [];
    const manager = {
      query: async (sql: string, parameters?: unknown[]) => {
        calls.push({ sql, parameters });
        if (sql.startsWith('SELECT "operationId"'))
          return [{ operationId: operation }];
        return [];
      },
    } as unknown as EntityManager;
    await installDeletionWriteFence(manager, operation, [
      { kind: 'account', id: account },
      { kind: 'profile', id: '21234567-89ab-4cde-8fab-0123456789ab' },
    ]);
    const lockKeys = calls
      .filter((c) => c.sql.includes('pg_advisory_xact_lock'))
      .map((c) => c.parameters?.[0] as string);
    expect(lockKeys).toEqual([...lockKeys].sort());
    expect(
      calls.some((c) => c.sql.includes('ON CONFLICT ("key") DO NOTHING'))
    ).toBe(true);
    expect(
      calls.every((c) => !JSON.stringify(c.parameters).includes(account))
    ).toBe(true);

    const foreign = {
      query: async (sql: string) =>
        sql.startsWith('SELECT "operationId"')
          ? [{ operationId: '21234567-89ab-4cde-8fab-0123456789ab' }]
          : [],
    } as unknown as EntityManager;
    await expect(
      installDeletionWriteFence(foreign, operation, [
        { kind: 'account', id: account },
      ])
    ).rejects.toThrow('DELETION_WRITE_FENCE_OWNERSHIP_CONFLICT');
  });

  it('sets transaction-local deletion context before invoking work', async () => {
    const order: string[] = [];
    const manager = {
      query: async (sql: string, parameters?: unknown[]) => {
        order.push(`${sql}:${String(parameters?.[0])}`);
      },
    } as unknown as EntityManager;
    const source = {
      transaction: async (work: (m: EntityManager) => Promise<string>) =>
        work(manager),
    } as unknown as DataSource;
    await expect(
      fencedDeletionTransaction(source, operation, async (m) => {
        order.push('work');
        expect(m).toBe(manager);
        return 'ok';
      })
    ).resolves.toBe('ok');
    expect(order).toEqual([
      `SELECT set_config('ot.deletion_operation', $1, true):${operation}`,
      'work',
    ]);
  });
});
