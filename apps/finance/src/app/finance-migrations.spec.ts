describe('finance migrations', () => {
  it('exports a migration for the finance tenant type column', async () => {
    const migrationModule = await import(
      '../migrations/1760613363000-add-finance-tenant-type'
    );

    const migrationExportNames = Object.keys(migrationModule);

    expect(
      migrationExportNames.some((name) =>
        /^AddFinanceTenantType\d{13}$/.test(name)
      )
    ).toBe(true);
  });

  it('exports a migration for the fin commander plan/goal/scenario tables', async () => {
    const migrationModule = await import(
      '../migrations/1772000000000-fin-commander'
    );

    const migrationExportNames = Object.keys(migrationModule);

    expect(
      migrationExportNames.some((name) => /^FinCommander\d{13}$/.test(name))
    ).toBe(true);
  });

  it('exports a migration for an optional Fin Commander goal funding account', async () => {
    const migrationModule = await import(
      '../migrations/1772100000000-fin-commander-funded-goal'
    );
    const migrationExportNames = Object.keys(migrationModule);

    expect(
      migrationExportNames.some((name) =>
        /^FinCommanderFundedGoal\d{13}$/.test(name)
      )
    ).toBe(true);
  });

  it('exports the durable Fin Commander funding directive migration', async () => {
    const migration = await import(
      '../migrations/1772200000000-fin-commander-funding-directive'
    );
    expect(migration.FinCommanderFundingDirective1772200000000).toBeDefined();
  });
});
