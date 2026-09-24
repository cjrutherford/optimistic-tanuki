import { Injectable, signal } from '@angular/core';
import { BrandProfile } from '../models/field-flow.models';

export const DEMO_BRAND_PROFILES: BrandProfile[] = [
  {
    id: 'apex-detailing',
    businessName: 'Apex Mobile Detailing',
    tradeCategory: 'Mobile Auto & Fleet Detailing',
    phone: '(912) 555-0144',
    email: 'service@apexdetailing-sav.com',
    serviceArea: 'Savannah, Pooler, and Richmond Hill',
    fixedDeposit: 50,
    taxRate: 0.07,
    googleReviewUrl: 'https://g.page/r/apex-detailing/review',
    isDemoMode: true,
    isStandalone: false,
  },
  {
    id: 'coastal-pressure-wash',
    businessName: 'Coastal Pressure Washing',
    tradeCategory: 'Commercial & Residential Surface Washing',
    phone: '(912) 555-0182',
    email: 'dispatch@coastalwash-ga.com',
    serviceArea: 'Chatham and Bryan Counties',
    fixedDeposit: 75,
    taxRate: 0.07,
    googleReviewUrl: 'https://g.page/r/coastal-wash/review',
    isDemoMode: true,
    isStandalone: false,
  },
  {
    id: 'wirepro-electrical',
    businessName: 'WirePro Electrical Services',
    tradeCategory: 'Licensed Electrical Contracting',
    phone: '(912) 555-0199',
    email: 'contact@wirepro-electric.com',
    serviceArea: 'Greater Savannah Metro Area',
    fixedDeposit: 100,
    taxRate: 0.07,
    googleReviewUrl: 'https://g.page/r/wirepro-electric/review',
    isDemoMode: true,
    isStandalone: false,
  },
  {
    id: 'summit-roofing',
    businessName: 'Summit Roofing & Exterior Restoration',
    tradeCategory: 'Roofing & Storm Restoration',
    phone: '(912) 555-0177',
    email: 'quotes@summitroofing-ga.com',
    serviceArea: 'Coastal Georgia',
    fixedDeposit: 150,
    taxRate: 0.07,
    googleReviewUrl: 'https://g.page/r/summit-roofing/review',
    isDemoMode: true,
    isStandalone: false,
  },
];

@Injectable({
  providedIn: 'root',
})
export class BrandConfigService {
  readonly currentBrand = signal<BrandProfile>(DEMO_BRAND_PROFILES[0]);
  readonly availableProfiles = signal<BrandProfile[]>(DEMO_BRAND_PROFILES);

  /**
   * Title displayed in UI headers and customer-facing views.
   * Completely excludes internal development terminology.
   */
  getAppTitle(): string {
    const brand = this.currentBrand();
    if (!brand.businessName || brand.businessName === 'Field Flow') {
      return 'Field Flow';
    }
    return `${brand.businessName} Field Flow`;
  }

  setBrandProfile(profileId: string): void {
    const found = this.availableProfiles().find((p) => p.id === profileId);
    if (found) {
      this.currentBrand.set(found);
    }
  }

  setCustomBrand(custom: Partial<BrandProfile>): void {
    this.currentBrand.update((existing) => ({
      ...existing,
      ...custom,
    }));
  }

  enableStandaloneMode(): void {
    this.currentBrand.update((existing) => ({
      ...existing,
      isStandalone: true,
      isDemoMode: false,
    }));
  }
}
