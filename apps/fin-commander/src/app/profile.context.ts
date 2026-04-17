import {
  Injectable,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { AuthStateService } from './state/auth-state.service';
import { ProfileService } from './profile.service';

@Injectable({
  providedIn: 'root',
})
export class ProfileContext {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly authState = inject(AuthStateService);
  private readonly profileService = inject(ProfileService);

  readonly currentProfile = signal<ProfileDto | null>(null);
  readonly currentProfiles = signal<ProfileDto[]>([]);
  readonly isAuthenticated = signal<boolean>(false);
  readonly currentProfileId = computed(() => this.currentProfile()?.id ?? null);
  readonly profileName = computed(
    () => this.currentProfile()?.profileName || 'Select profile'
  );

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    effect(() => {
      this.isAuthenticated.set(this.authState.isAuthenticated);
    });

    this.authState.isAuthenticated$.subscribe((isAuthenticated) => {
      this.isAuthenticated.set(isAuthenticated);
      if (isAuthenticated) {
        void this.loadProfile();
      } else {
        this.currentProfile.set(null);
        this.currentProfiles.set([]);
      }
    });

    this.authState.currentProfile$.subscribe((profile) => {
      if (profile) {
        this.currentProfile.set(profile);
      }
    });

    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const profiles = this.profileService.getCurrentUserProfiles();
    if (profiles.length > 0) {
      this.currentProfiles.set(profiles);
    }

    const profile = this.profileService.getCurrentUserProfile();
    if (profile) {
      this.currentProfile.set(profile);
    }
  }

  async loadProfile(): Promise<void> {
    await this.profileService.getAllProfiles();
    this.currentProfiles.set(this.profileService.getCurrentUserProfiles());
    this.currentProfile.set(this.profileService.getCurrentUserProfile());
  }

  selectProfile(profile: ProfileDto): void {
    this.profileService.selectProfile(profile);
    this.currentProfile.set(profile);
    this.currentProfiles.set(this.profileService.getCurrentUserProfiles());
  }
}
