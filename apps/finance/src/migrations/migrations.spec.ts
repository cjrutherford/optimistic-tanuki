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
});
