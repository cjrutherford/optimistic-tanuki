import { AuditErasureRunner, AuditErasurePolicy } from './audit-erasure';
const subject = {
  accountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  profileIds: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
};
const policy: AuditErasurePolicy = {
  table: 'audit',
  accountColumns: ['actor'],
  profileColumns: ['profile'],
  clearColumns: { details: 'json-object' },
};
const id = '11111111-1111-4111-8111-111111111111';
const setup = () => {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes(' AS unsafe')) return [{ n: '1', unsafe: '0' }];
    if (sql.startsWith('WITH changed')) return [{ n: '1', ids: [id] }];
    if (sql.startsWith('SELECT count(*)')) return [{ n: '0' }];
    return [];
  });
  const transaction = jest.fn(async (run) => run({ query }));
  return {
    query,
    transaction,
    runner: new AuditErasureRunner({ transaction }),
  };
};
describe('Audit erasure boundary', () => {
  it('validates identity and schema policy before touching the database', async () => {
    const s = setup();
    await expect(
      s.runner.erase({ ...subject, accountId: 'private-not-uuid' }, [policy])
    ).rejects.toThrow('INVALID_LOG_SUBJECT_SELECTION');
    await expect(
      s.runner.erase(subject, [{ ...policy, table: 'audit; DROP TABLE post' }])
    ).rejects.toThrow('INVALID_AUDIT_ERASURE_POLICY');
    expect(s.transaction).not.toHaveBeenCalled();
  });
  it('locks the declared table, parameterizes identities and independently verifies payload readback', async () => {
    const s = setup();
    const receipt = await s.runner.erase(subject, [policy]);
    expect(receipt.allDeclaredSourcesVerified).toBe(true);
    expect(
      s.query.mock.calls.some(([sql]) =>
        sql.includes('LOCK TABLE "public"."audit"')
      )
    ).toBe(true);
    expect(
      s.query.mock.calls.every(([sql]) => !sql.includes(subject.accountId))
    ).toBe(true);
    expect(
      s.query.mock.calls.some(([sql]) =>
        sql.includes('FILTER (WHERE "details" IS DISTINCT FROM')
      )
    ).toBe(true);
  });
  it('rejects nonzero identity readback and hides the raw driver error', async () => {
    const s = setup();
    s.query.mockImplementation(async (sql) => {
      if (sql.startsWith('WITH changed'))
        throw new Error('PRIVATE_QUERY_PAYLOAD');
      return [{ n: '0' }];
    });
    await expect(s.runner.erase(subject, [policy])).rejects.toThrow(
      'AUDIT_ERASURE_FAILED'
    );
  });
  it('does not acknowledge a trigger that reintroduces private payload into a touched receipt', async () => {
    const s = setup();
    s.query.mockImplementation(async (sql) => {
      if (sql.includes(' AS unsafe')) return [{ n: '1', unsafe: '1' }] as never;
      if (sql.startsWith('WITH changed'))
        return [{ n: '1', ids: [id] }] as never;
      return [{ n: '0' }] as never;
    });
    await expect(s.runner.erase(subject, [policy])).rejects.toThrow(
      'AUDIT_ERASURE_FAILED'
    );
  });
});
