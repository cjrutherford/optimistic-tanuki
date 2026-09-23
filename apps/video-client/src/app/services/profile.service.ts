import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { OptomisitcTanukiAPIService } from '@optimistic-tanuki/profile-ui-data-access';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private platformId = inject(PLATFORM_ID);
  private readonly profiles = inject(OptomisitcTanukiAPIService);
  private currentProfileSubject = new BehaviorSubject<ProfileDto | null>(null);
  private profilesSubject = new BehaviorSubject<ProfileDto[]>([]);

  public currentProfile$ = this.currentProfileSubject.asObservable();
  public profiles$ = this.profilesSubject.asObservable();

  async getAllProfiles(): Promise<ProfileDto[]> {
    const profiles = await firstValueFrom(
      this.profiles.profileControllerGetAllProfiles<ProfileDto[]>()
    );
    this.profilesSubject.next(profiles);
    return profiles;
  }

  async getProfileById(id: string): Promise<ProfileDto> {
    // Canonical read (by-id adds telos back-fill); the legacy :id route stays.
    return firstValueFrom(
      this.profiles.profileControllerGetProfileById<ProfileDto>(id)
    );
  }

  async createProfile(profile: Partial<ProfileDto>): Promise<ProfileDto> {
    const newProfile = await firstValueFrom(
      this.profiles.profileControllerCreateProfile<ProfileDto>(
        profile as Parameters<
          typeof this.profiles.profileControllerCreateProfile
        >[0]
      )
    );
    const profiles = this.profilesSubject.value;
    this.profilesSubject.next([...profiles, newProfile]);
    return newProfile;
  }

  async updateProfile(
    id: string,
    profile: Partial<ProfileDto>
  ): Promise<ProfileDto> {
    const updatedProfile = await firstValueFrom(
      this.profiles.profileControllerUpdateProfile<ProfileDto>(id, profile)
    );
    const profiles = this.profilesSubject.value.map((p) =>
      p.id === id ? updatedProfile : p
    );
    this.profilesSubject.next(profiles);
    if (this.currentProfileSubject.value?.id === id) {
      this.currentProfileSubject.next(updatedProfile);
    }
    return updatedProfile;
  }

  selectProfile(profile: ProfileDto): void {
    this.currentProfileSubject.next(profile);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('selectedProfile', JSON.stringify(profile));
    }
  }

  getCurrentUserProfile(): ProfileDto | null {
    return this.currentProfileSubject.value;
  }

  getCurrentUserProfiles(): ProfileDto[] {
    return this.profilesSubject.value;
  }

  loadStoredProfile(): void {
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem('selectedProfile');
      if (stored) {
        try {
          const profile = JSON.parse(stored);
          this.currentProfileSubject.next(profile);
        } catch {
          console.error('Failed to parse stored profile');
        }
      }
    }
  }
}
