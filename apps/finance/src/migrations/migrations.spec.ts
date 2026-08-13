describe('finance migrations', () => {
  it('exports a migration for the finance tenant type column', async () => {
    const migrationModule = await import('./add-finance-tenant-type.migration');

    const migrationExportNames = Object.keys(migrationModule);

    expect(
      migrationExportNames.some((name) =>
        /^AddFinanceTenantType\d{13}$/.test(name)
      )
    ).toBe(true);
  });

  it('exports a migration for the fin commander plan/goal/scenario tables', async () => {
    const migrationModule = await import('./1772000000000-fin-commander');

    const migrationExportNames = Object.keys(migrationModule);

    expect(
      migrationExportNames.some((name) => /^FinCommander\d{13}$/.test(name))
    ).toBe(true);
  });

  it('exports a migration for an optional Fin Commander goal funding account', async () => {
    const migrationModule = await import(
      './1772100000000-fin-commander-funded-goal'
    );
    const migrationExportNames = Object.keys(migrationModule);

    expect(
      migrationExportNames.some((name) =>
        /^FinCommanderFundedGoal\d{13}$/.test(name)
      )
    ).toBe(true);
  });
});
