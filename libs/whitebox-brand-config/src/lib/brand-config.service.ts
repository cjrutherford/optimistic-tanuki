import { computed, Injectable, signal } from '@angular/core';
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
  readonly resolutionState = signal<'unresolved' | 'resolved'>('unresolved');
  readonly resolvedBrand = computed(() =>
    this.resolutionState() === 'resolved' ? this.currentBrand() : null
  );

  /**
   * Returns title for UI headers and customer views, never containing internal terminology.
   */
  getAppTitle(appSuffix = 'Field Flow'): string {
    const brand = this.resolvedBrand();
    if (!brand) {
      return appSuffix;
    }
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

  resolveBrandProfile(profileId: string): boolean {
    const found = this.availableProfiles().find((p) => p.id === profileId);
    if (!found) {
      this.resolutionState.set('unresolved');
      return false;
    }
    this.currentBrand.set(found);
    this.resolutionState.set('resolved');
    return true;
  }

  getResolvedBrand(): WhiteboxBrandProfile | null {
    return this.resolvedBrand();
  }

  clearResolvedBrand(): void {
    this.resolutionState.set('unresolved');
  }

  getProfileById(profileId: string): WhiteboxBrandProfile | undefined {
    return this.availableProfiles().find((p) => p.id === profileId);
  }

  updateProfile(updated: WhiteboxBrandProfile): void {
    this.availableProfiles.update((profiles) =>
      profiles.map((p) => (p.id === updated.id ? updated : p))
    );
    if (this.currentBrand().id === updated.id) {
      this.currentBrand.set(updated);
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
