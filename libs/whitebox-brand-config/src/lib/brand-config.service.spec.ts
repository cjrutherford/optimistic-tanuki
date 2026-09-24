import { WhiteboxBrandConfigService } from './brand-config.service';

describe('WhiteboxBrandConfigService', () => {
  let service: WhiteboxBrandConfigService;

  beforeEach(() => {
    service = new WhiteboxBrandConfigService();
  });

  it('initializes with default trade and field brand profile', () => {
    expect(service.currentBrand().businessName).toBe('Apex Mobile Detailing');
    expect(service.currentBrand().vertical).toBe('trade_field');
  });

  it('formats app title without internal terminology', () => {
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

    service.enableStandaloneMode();
    expect(service.currentBrand().isStandalone).toBe(true);
    expect(service.currentBrand().isDemoMode).toBe(false);
  });
});
