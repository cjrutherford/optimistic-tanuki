import { TestBed } from '@angular/core/testing';
import {
  BrandConfigService,
  DEMO_BRAND_PROFILES,
} from './brand-config.service';

describe('BrandConfigService', () => {
  let service: BrandConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BrandConfigService);
  });

  it('initializes with the default Apex Mobile Detailing trade profile', () => {
    expect(service.currentBrand().businessName).toBe('Apex Mobile Detailing');
    expect(service.currentBrand().fixedDeposit).toBe(50);
  });

  it('formats app title without internal whitebox terminology', () => {
    const title = service.getAppTitle();
    expect(title).toBe('Apex Mobile Detailing Field Flow');
    expect(title.toLowerCase()).not.toContain('whitebox');
    expect(title.toLowerCase()).not.toContain('slice');
  });

  it('switches trade profiles dynamically', () => {
    service.setBrandProfile('coastal-pressure-wash');
    expect(service.currentBrand().businessName).toBe(
      'Coastal Pressure Washing'
    );
    expect(service.getAppTitle()).toBe('Coastal Pressure Washing Field Flow');
  });

  it('enables standalone on-premises mode', () => {
    service.enableStandaloneMode();
    expect(service.currentBrand().isStandalone).toBe(true);
    expect(service.currentBrand().isDemoMode).toBe(false);
  });
});
