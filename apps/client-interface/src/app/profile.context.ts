import {
  Injectable,
  signal,
  computed,
  inject,
  effect,
  PLATFORM_ID,
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
  readonly profileName = computed(
    () => this.currentProfile()?.profileName || ''
  );
  readonly profilePic = computed(() => this.currentProfile()?.profilePic || '');
  readonly profileId = computed(() => this.currentProfile()?.id || '');

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    effect(() => {
      const auth = this.authState.isAuthenticated;
      this.isAuthenticated.set(auth);
    });

    this.authState.isAuthenticated$.subscribe((isAuth) => {
      this.isAuthenticated.set(isAuth);
      if (isAuth) {
        this.loadProfile();
      } else {
        this.currentProfile.set(null);
        this.currentProfiles.set([]);
      }
    });

    this.authState.currentProfile$.subscribe((profile) => {
      if (profile) {
        this.currentProfile.set(profile);
      } else {
        const savedProfile = this.profileService.getCurrentUserProfile();
        this.currentProfile.set(savedProfile);
      }
    });

    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const profiles = this.profileService.getCurrentUserProfiles();
    if (profiles && profiles.length > 0) {
      this.currentProfiles.set(profiles);
    }

    const profile = this.profileService.getCurrentUserProfile();
    if (profile) {
      this.currentProfile.set(profile);
    }
  }

  async loadProfile(): Promise<void> {
    try {
      await this.profileService.getAllProfiles();
      const profile = this.profileService.getCurrentUserProfile();
      this.currentProfile.set(profile);
      this.currentProfiles.set(this.profileService.getCurrentUserProfiles());
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  }

  selectProfile(profile: ProfileDto): void {
    this.profileService.selectProfile(profile);
    this.currentProfile.set(profile);
  }

  refreshProfile(): void {
    const profile = this.profileService.getCurrentUserProfile();
    this.currentProfile.set(profile);
    this.currentProfiles.set(this.profileService.getCurrentUserProfiles());
  }
}
