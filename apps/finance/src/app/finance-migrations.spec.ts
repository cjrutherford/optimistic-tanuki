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

  it('protects persisted escrow records with tenant RLS', async () => {
    const migration = await import('../migrations/1790342843391-vault-escrow');
    const queries: string[] = [];
    await new migration.VaultEscrow1790342843391().up({
      query: async (sql: string) => queries.push(sql),
    } as any);

    expect(
      queries.some((sql) => sql.includes('CREATE TABLE "vault_escrows"'))
    ).toBe(true);
    expect(
      queries.some(
        (sql) =>
          sql.includes('ENABLE ROW LEVEL SECURITY') &&
          sql.includes('vault_escrows')
      )
    ).toBe(true);
    expect(
      queries.some(
        (sql) =>
          sql.includes('FORCE ROW LEVEL SECURITY') &&
          sql.includes('vault_escrows')
      )
    ).toBe(true);
    expect(
      queries.some((sql) =>
        sql.includes('CREATE POLICY "vault_escrows_tenant_isolation"')
      )
    ).toBe(true);
  });

  it('protects persisted OTP challenges with tenant RLS', async () => {
    const migration = await import(
      '../migrations/1790342980980-otp-challenges'
    );
    const queries: string[] = [];
    await new migration.OtpChallenges1790342980980().up({
      query: async (sql: string) => queries.push(sql),
    } as any);

    expect(
      queries.some((sql) => sql.includes('CREATE TABLE "otp_challenges"'))
    ).toBe(true);
    expect(
      queries.some(
        (sql) =>
          sql.includes('ENABLE ROW LEVEL SECURITY') &&
          sql.includes('otp_challenges')
      )
    ).toBe(true);
    expect(
      queries.some(
        (sql) =>
          sql.includes('FORCE ROW LEVEL SECURITY') &&
          sql.includes('otp_challenges')
      )
    ).toBe(true);
    expect(
      queries.some((sql) =>
        sql.includes('CREATE POLICY "otp_challenges_tenant_isolation"')
      )
    ).toBe(true);
  });
});
