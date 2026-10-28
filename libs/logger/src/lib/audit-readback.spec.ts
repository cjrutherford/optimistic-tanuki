import { AuditErasureRunner } from './audit-erasure';
import { randomUUID } from 'node:crypto';
const subject = { accountId: randomUUID(), profileIds: [randomUUID()] };
const policies = [
  {
    table: 'audit',
    accountColumns: ['actorUserId'],
    profileColumns: ['profileId'],
  },
];
function fixture() {
  const query = jest.fn(async (sql: string) =>
    sql.startsWith('SELECT count') ? [{ n: '0' }] : []
  );
  const database = {
    transaction: async <T>(
      run: (transaction: { query: typeof query }) => Promise<T>
    ) => run({ query }),
  };
  return { query, runner: new AuditErasureRunner(database) };
}
it('reads bound identities without changing audit history or needing a live profile table', async () => {
  const f = fixture();
  expect(await f.runner.readback(subject, policies)).toBe(0);
  const calls = f.query.mock.calls;
  expect(calls[0][0]).toBe('SET TRANSACTION READ ONLY');
  expect(calls.some(([sql]) => /UPDATE|DELETE|JOIN.*profile/.test(sql))).toBe(
    false
  );
  expect(calls[2][0]).toContain('LIMIT 100001');
  expect((calls[2] as unknown[])[1]).toEqual([
    subject.accountId,
    subject.profileIds,
  ]);
});
it('reports surviving participation and rejects malformed/unbounded/failed readback', async () => {
  const f = fixture();
  f.query
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ n: '1' }]);
  expect(await f.runner.readback(subject, policies)).toBe(1);
  for (const n of ['100001', 'not-count']) {
    f.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ n }]);
    await expect(f.runner.readback(subject, policies)).rejects.toThrow(
      'AUDIT_READBACK_FAILED'
    );
  }
  await expect(
    f.runner.readback(subject, [{ ...policies[0], table: 'unsafe;' }])
  ).rejects.toThrow('INVALID_AUDIT_ERASURE_POLICY');
});
