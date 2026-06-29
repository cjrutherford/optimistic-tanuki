import staticSource from './staticDatabase';

describe('payments static datasource', () => {
  it('initializes migrations in baseline-first order', () => {
    const migrations = staticSource.options.migrations as Function[];

    expect(migrations.map((migration) => migration.name)).toEqual([
      'Initial1774396807253',
      'BusinessPageAnchorColumns1782648600000',
    ]);
  });
});
