describe('DEV_BUSINESS_TENANT_PRESETS', () => {
  it('does not use tenant wording in owner-facing preset copy', async () => {
    const { DEV_BUSINESS_TENANT_PRESETS } = await import(
      './sample-tenants.mjs'
    );

    const ownerFacingText = DEV_BUSINESS_TENANT_PRESETS.flatMap((preset) => {
      const { configKey: _configKey, ...copyPreset } = preset;
      return JSON.stringify([copyPreset]);
    });

    expect(ownerFacingText).not.toContain('tenant');
  });

  it('includes an accountant POC preset with bookkeeping and tax advisory services', async () => {
    const { DEV_BUSINESS_TENANT_PRESETS } = await import(
      './sample-tenants.mjs'
    );

    const accountant = DEV_BUSINESS_TENANT_PRESETS.find(
      (preset: { businessType: string; site: { slug: string } }) =>
        preset.businessType === 'accounting' &&
        preset.site.slug === 'ledgerline-accounting'
    );

    expect(accountant).toBeDefined();
    expect(accountant.site.status).toBe('published');
    expect(accountant.owner.email).toBe('owner-accountant@localbusiness.test');
    expect(accountant.brand.businessName).toBe('Ledgerline Accounting');
    expect(accountant.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: expect.stringMatching(/tax|bookkeeping/i),
        }),
        expect.objectContaining({
          name: expect.stringMatching(/payroll|planning/i),
        }),
      ])
    );
    expect(accountant.brand.specializations).toEqual(
      expect.arrayContaining([
        'Bookkeeping cleanup',
        'Tax planning',
        'Payroll review',
        'Advisory',
      ])
    );
    expect(accountant.clientPortal.capabilities).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/deadline|document|review/i),
      ])
    );
  });

  it('includes a seeded independent artist tenant with store-backed inventory and commission services', async () => {
    const { DEV_BUSINESS_TENANT_PRESETS } = await import(
      './sample-tenants.mjs'
    );

    const tenant = DEV_BUSINESS_TENANT_PRESETS.find(
      (preset: { site: { slug: string } }) =>
        preset.site.slug === 'emberline-studio'
    );

    expect(tenant).toBeDefined();
    expect(tenant.site.status).toBe('published');
    expect(tenant.owner.email).toBe('owner-artist@localbusiness.test');
    expect(tenant.features.store).toEqual({ enabled: true });
    expect(tenant.serviceCatalog).toEqual({ source: 'store' });
    expect(tenant.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'portrait-commission-consult',
          allowOnlineBooking: true,
        }),
        expect.objectContaining({
          id: 'custom-pet-portrait-commission',
          allowOnlineBooking: true,
        }),
      ])
    );
    expect(tenant.brand.businessName).toBe('Emberline Studio');
    expect(tenant.brand.specializations).toEqual(
      expect.arrayContaining([
        'Commissioned portraits',
        'Ready-to-ship originals',
      ])
    );
    expect(
      tenant.landingPage.sections.some(
        (section: { type: string }) => section.type === 'store'
      )
    ).toBe(true);
  });
});
