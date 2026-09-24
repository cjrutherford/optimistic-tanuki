import { Injectable, signal } from '@angular/core';
import {
  SHARED_WHITEBOX_PROFILES,
  WhiteboxBrandProfile,
  WhiteboxVertical,
} from './brand-config.models';

@Injectable({
  providedIn: 'root',
})
export class WhiteboxBrandConfigService {
  readonly currentBrand = signal<WhiteboxBrandProfile>(
    SHARED_WHITEBOX_PROFILES[0]
  );
  readonly availableProfiles = signal<WhiteboxBrandProfile[]>(
    SHARED_WHITEBOX_PROFILES
  );

  /**
   * Returns title for UI headers and customer views, never containing internal terminology.
   */
  getAppTitle(appSuffix = 'Field Flow'): string {
    const brand = this.currentBrand();
    if (!brand.businessName || brand.businessName === appSuffix) {
      return appSuffix;
    }
    return `${brand.businessName} ${appSuffix}`;
  }

  setBrandProfile(profileId: string): void {
    const found = this.availableProfiles().find((p) => p.id === profileId);
    if (found) {
      this.currentBrand.set(found);
    }
  }

  setCustomBrand(custom: Partial<WhiteboxBrandProfile>): void {
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

  getProfilesForVertical(vertical: WhiteboxVertical): WhiteboxBrandProfile[] {
    return this.availableProfiles().filter((p) => p.vertical === vertical);
  }
}

export { WhiteboxBrandConfigService as BrandConfigService };
