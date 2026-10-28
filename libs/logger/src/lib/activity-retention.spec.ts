import {
  ActivityRetentionService,
  activityRetentionRule,
} from './activity-retention';
describe('ninety-day activity retention', () => {
  const cutoff = '2026-01-01T00:00:00.123456Z';
  const rule = {
    table: 'activity',
    timeColumn: 'createdAt',
    timestampWithZone: false,
  };
  function fixture(fail = false, remaining = '0') {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('AS cutoff'))
        return [{ cutoff: '2026-07-01T00:00:00.123456Z' }];
      if (sql.includes('DELETE FROM')) {
        if (fail) throw Error('private database failure');
        return [[{ id: 'one' }], 1];
      }
      if (sql.includes('AS remaining')) return [{ remaining }];
      return [];
    });
    return {
      query,
      db: {
        query,
        transaction: async <T>(
          run: (m: { query: typeof query }) => Promise<T>
        ) => run({ query }),
      },
    };
  }
  it('uses a bounded inclusive UTC cutoff and independent readback', async () => {
    const f = fixture();
    const service = new ActivityRetentionService('social', f.db, [rule]);
    const report = await service.sweep(cutoff);
    expect(report.state).toBe('verified');
    expect(report.sources[0]).toMatchObject({ deleted: 1, remaining: 0 });
    const deletion = f.query.mock.calls.find(([sql]) =>
      sql.includes('DELETE FROM')
    )![0];
    expect(deletion).toContain('<=');
    expect(deletion).toContain('AT TIME ZONE');
    expect(deletion).toContain('LIMIT 200');
    expect(deletion).toContain('SKIP LOCKED');
    expect(
      f.query.mock.calls.some(([sql]) => sql.includes('AS remaining'))
    ).toBe(true);
  });
  it('does not report completion after deletion failure or a nonempty readback', async () => {
    expect(
      (
        await new ActivityRetentionService('social', fixture(true).db, [
          rule,
        ]).sweep(cutoff)
      ).state
    ).toBe('blocked');
    expect(
      (
        await new ActivityRetentionService('social', fixture(false, '1').db, [
          rule,
        ]).sweep(cutoff)
      ).state
    ).toBe('pending');
  });
  it('rejects unsafe identifiers and unsupported metadata before touching data', () => {
    expect(
      () =>
        new ActivityRetentionService('social', fixture().db, [
          { ...rule, table: 'activity;DELETE' },
        ])
    ).toThrow();
    expect(() =>
      activityRetentionRule({
        tableName: 'activity',
        findColumnWithPropertyName: () => ({
          databaseName: 'createdAt',
          type: 'jsonb',
        }),
      })
    ).toThrow();
  });
});
