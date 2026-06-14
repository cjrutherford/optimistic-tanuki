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
  });
});
