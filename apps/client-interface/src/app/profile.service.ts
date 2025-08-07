import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import {
  ProfileDto,
  CreateProfileDto,
  CreateAssetDto,
  AssetDto,
  UpdateProfileDto,
} from '@optimistic-tanuki/ui-models';
import { firstValueFrom, switchMap, forkJoin, map } from 'rxjs';
import { AuthStateService } from './state/auth-state.service';
import { isPlatformBrowser } from '@angular/common';

/**
 * Service for managing user profiles.
 */
@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  /**
   * Signal that holds the current user's profiles.
   */
  currentUserProfiles = signal<ProfileDto[]>([]);
  /**
   * Signal that holds all profiles.
   */
  allProfiles = signal<ProfileDto[]>([]);
  /**
   * Signal that holds the currently selected user profile.
   */
  currentUserProfile = signal<ProfileDto | null>(null);
  /**
   * Creates an instance of ProfileService.
   * @param http The HttpClient instance.
   * @param authState The AuthStateService instance.
   */
  constructor(
    private readonly http: HttpClient,
    private readonly authState: AuthStateService,
    @Inject(PLATFORM_ID) private readonly platformId: object
  ) {}

  /**
   * Selects a profile as the current user profile.
   * @param _p The profile to select.
   */
  selectProfile(_p: ProfileDto) {
    const profile = this.currentUserProfiles().find((p) => p.id === _p.id);
    if (profile && isPlatformBrowser(this.platformId)) {
      this.currentUserProfile.set(profile);
      localStorage.setItem('selectedProfile', JSON.stringify(profile));
    }
  }

  /**
   * Returns the current user's profiles.
   * @returns An array of ProfileDto.
   */
  getCurrentUserProfiles() {
    return this.currentUserProfiles();
  }

  /**
   * Returns the currently selected user profile.
   * @returns The current ProfileDto or null.
   */
  getCurrentUserProfile() {
    return this.currentUserProfile();
  }

  /**
   * Retrieves all profiles from the server and updates the signals.
   */
  async getAllProfiles() {
    const profiles = await firstValueFrom(
      this.http.get<ProfileDto[]>('/api/profile')
    );
    this.allProfiles.set(profiles);
    this.currentUserProfiles.set(
      profiles.filter(
        (p) => p.userId === this.authState.getDecodedTokenValue()?.userId
      )
    );
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('profiles', JSON.stringify(profiles));
    }
  }

  /**
   * Retrieves a profile by its ID from the server and sets it as the current user profile.
   * @param id The ID of the profile to retrieve.
   */
  async getProfileById(id: string) {
    const profile = await firstValueFrom(
      this.http.get<ProfileDto>(`/api/profile/${id}`)
    );
    this.currentUserProfile.set(profile);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('selectedProfile', JSON.stringify(profile));
    }
  }

  /**
   * Creates a new profile.
   * @param profile The profile data to create.
   */
  async createProfile(profile: CreateProfileDto) {
    const originalProfilePic = profile.profilePic;
    const originalCoverPic = profile.coverPic;
    profile.profilePic = '';
    profile.coverPic = '';
    const tokenValue = this.authState.getDecodedTokenValue();
    if (tokenValue) {
      profile.userId = tokenValue.userId;
    }
    const newProfile = await firstValueFrom(
      this.http.post<ProfileDto>('/api/profile', profile)
    );
    const profilePhotoDto: CreateAssetDto = {
      name: `profile-${newProfile.profileName}-photo`,
      profileId: newProfile.id,
      type: 'image',
      content: originalProfilePic,
    };
    const coverPhotoDto: CreateAssetDto = {
      name: `profile-${newProfile.profileName}-cover`,
      profileId: newProfile.id,
      type: 'image',
      content: originalCoverPic,
    };
    const profileAsset = await firstValueFrom(
      this.http.post<AssetDto>(`/api/asset`, profilePhotoDto)
    );
    const coverAsset = await firstValueFrom(
      this.http.post<AssetDto>(`/api/asset`, coverPhotoDto)
    );

    newProfile.profilePic = `/api/asset/${profileAsset.id}`;
    newProfile.coverPic = `/api/asset/${coverAsset.id}`;
    await firstValueFrom(
      this.http.put<ProfileDto>(`/api/profile/${newProfile.id}`, {
        profilePic: newProfile.profilePic,
        coverPic: newProfile.coverPic,
      })
    );

    this.currentUserProfiles.update((profiles) => [...profiles, newProfile]);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(
        'profiles',
        JSON.stringify(this.currentUserProfiles())
      );
    }
  }

  /**
   * Updates an existing profile.
   * @param id The ID of the profile to update.
   * @param profile The updated profile data.
   */
  async updateProfile(id: string, profile: UpdateProfileDto) {
    if (profile.profilePic && !profile.profilePic.startsWith('/api/asset/')) {
      // Get the original profile to compare the current asset
      const originalProfile = await firstValueFrom(
        this.http.get<ProfileDto>(`/api/profile/${id}`)
      );
      const originalAssetUrl = originalProfile.profilePic;

      // If the asset is different and exists, delete the old asset
      if (originalAssetUrl && originalAssetUrl !== profile.profilePic) {
        const assetId = originalAssetUrl.split('/').pop();
        if (assetId) {
          await firstValueFrom(this.http.delete(originalAssetUrl));
        }
      }

      // Create the new asset with the new image
      const newProfilePic: CreateAssetDto = {
        name: `profile-${originalProfile.profileName}-photo`,
        profileId: originalProfile.id,
        type: 'image',
        content: profile.profilePic,
      };
      const profileAsset = await firstValueFrom(
        this.http.post<AssetDto>('/api/asset/', newProfilePic)
      );
      profile.profilePic = `/api/asset/${profileAsset.id}`;
    }
    if (profile.coverPic && !profile.coverPic.startsWith('/api/asset/')) {
      const originalProfile = await firstValueFrom(
        this.http.get<ProfileDto>(`/api/profile/${id}`)
      );
      const originalAssetUrl = originalProfile.coverPic;

      if (originalAssetUrl && originalAssetUrl !== profile.coverPic) {
        const assetId = originalAssetUrl.split('/').pop();
        if (assetId) {
          await firstValueFrom(this.http.delete(originalAssetUrl));
        }
      }
      const newCoverPic: CreateAssetDto = {
        name: `profile-${originalProfile.profileName}-cover`,
        profileId: originalProfile.id,
        type: 'image',
        content: profile.coverPic,
      };
      const coverAsset = await firstValueFrom(
        this.http.post<AssetDto>('/api/asset/', newCoverPic)
      );
      profile.coverPic = `/api/asset/${coverAsset.id}`;
    }
    const updatedProfile = await firstValueFrom(
      this.http.put<ProfileDto>(`/api/profile/${id}`, profile)
    );
    this.currentUserProfiles.update((profiles) =>
      profiles.map((p) => (p.id === id ? updatedProfile : p))
    );
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(
        'profiles',
        JSON.stringify(this.currentUserProfiles())
      );
    }
    if (this.currentUserProfile()?.id === id) {
      this.currentUserProfile.set(updatedProfile);
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem('selectedProfile', JSON.stringify(updatedProfile));
      }
    }
  }

  /**
   * Deletes a profile by its ID.
   * @param id The ID of the profile to delete.
   */
  async deleteProfile(id: string) {
    await firstValueFrom(this.http.delete<void>(`/api/profiles/${id}`));
    this.currentUserProfiles.update((profiles) =>
      profiles.filter((p) => p.id !== id)
    );
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(
        'profiles',
        JSON.stringify(this.currentUserProfiles())
      );
    }
    if (this.currentUserProfile()?.id === id) {
      this.currentUserProfile.set(null);
      if (isPlatformBrowser(this.platformId)) {
        localStorage.removeItem('selectedProfile');
      }
    }
  }

  /**
   * Loads profiles from local storage.
   */
  loadProfilesFromLocalStorage() {
    if (isPlatformBrowser(this.platformId)) {
      const profiles = localStorage.getItem('profiles');
      if (profiles) {
        this.currentUserProfiles.set(JSON.parse(profiles));
      }
      const selectedProfile = localStorage.getItem('selectedProfile');
      if (selectedProfile) {
        this.currentUserProfile.set(JSON.parse(selectedProfile));
      }
    }
  }

  /**
   * Persists profiles to local storage.
   */
  persistProfilesToLocalStorage() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(
        'profiles',
        JSON.stringify(this.currentUserProfiles())
      );
      localStorage.setItem(
        'selectedProfile',
        JSON.stringify(this.currentUserProfile())
      );
    }
  }

  /**
   * Retrieves a display profile by its ID, including profile and cover pictures.
   * @param id The ID of the profile to retrieve.
   * @returns An Observable of the ProfileDto with profile and cover pictures.
   */
  getDisplayProfile(id: string) {
    return this.http.get<ProfileDto>(`/api/profile/${id}`).pipe(
      switchMap((profile) =>
        forkJoin({
          profilePic: this.http
            .get<{ profilePic: string }>(`/api/profile/${id}/photo`)
            .pipe(map((res) => res.profilePic)),
          coverPic: this.http
            .get<{ coverPic: string }>(`/api/profile/${id}/cover`)
            .pipe(map((res) => res.coverPic)),
        }).pipe(
          map(({ profilePic, coverPic }) => {
            profile.profilePic = profilePic;
            profile.coverPic = coverPic;
            return profile;
          })
        )
      )
    );
  }
}
