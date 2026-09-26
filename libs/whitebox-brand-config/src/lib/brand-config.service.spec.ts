import { WhiteboxBrandConfigService } from './brand-config.service';

describe('WhiteboxBrandConfigService', () => {
  let service: WhiteboxBrandConfigService;

  beforeEach(() => {
    service = new WhiteboxBrandConfigService();
  });

  it('starts unresolved instead of treating a demo profile as a tenant', () => {
    expect(service.resolutionState()).toBe('unresolved');
    expect(service.resolvedBrand()).toBeNull();
    expect(service.getResolvedBrand()).toBeNull();
  });

  it('resolves only an explicitly selected host profile', () => {
    expect(service.resolveBrandProfile('coastal-pressure-wash')).toBe(true);
    expect(service.resolutionState()).toBe('resolved');
    expect(service.resolvedBrand()?.id).toBe('coastal-pressure-wash');
    expect(service.getResolvedBrand()?.tradeCategory).toContain(
      'Surface Washing'
    );
  });

  it('leaves the profile unresolved when host resolution does not match', () => {
    expect(service.resolveBrandProfile('missing-tenant')).toBe(false);
    expect(service.resolutionState()).toBe('unresolved');
    expect(service.resolvedBrand()).toBeNull();
  });

  it('formats app title without internal terminology', () => {
    service.resolveBrandProfile('apex-detailing');
    const title = service.getAppTitle('Field Flow');
    expect(title).toBe('Apex Mobile Detailing Field Flow');
    expect(title.toLowerCase()).not.toContain('whitebox');
    expect(title.toLowerCase()).not.toContain('slice');
  });

  it('filters available profiles by industry vertical', () => {
    const cpaProfiles = service.getProfilesForVertical('cpa_tax');
    expect(cpaProfiles.length).toBeGreaterThan(0);
    expect(cpaProfiles[0].tradeCategory).toContain('CPA');
  });

  it('switches brand profiles and supports standalone mode', () => {
    service.setBrandProfile('coastal-pressure-wash');
    expect(service.currentBrand().businessName).toBe(
      'Coastal Pressure Washing'
    );
    expect(service.currentBrand().services[0].name).toContain(
      'Surface Cleaning'
    );

    service.enableStandaloneMode();
    expect(service.currentBrand().isStandalone).toBe(true);
    expect(service.currentBrand().isDemoMode).toBe(false);
  });

  it('updates an existing profile and reflects changes in currentBrand', () => {
    const profile = service.getProfileById('apex-detailing');
    expect(profile).toBeDefined();
    if (profile) {
      service.updateProfile({
        ...profile,
        fixedDeposit: 95,
      });
      expect(service.currentBrand().fixedDeposit).toBe(95);
    }
  });
});
