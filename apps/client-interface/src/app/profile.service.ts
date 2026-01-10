import { HttpClient } from '@angular/common/http';
import { Injectable, signal, inject } from '@angular/core';
import {
  ProfileDto,
  CreateProfileDto,
  UpdateProfileDto,
  AssetDto,
  CreateAssetDto,
} from '@optimistic-tanuki/ui-models';
import { firstValueFrom, map, switchMap, forkJoin } from 'rxjs';
import { AuthStateService } from './state/auth-state.service';
import { UpdateAttachmentDto } from '@optimistic-tanuki/social-ui';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  currentUserProfiles = signal<ProfileDto[]>([]);
  allProfiles = signal<ProfileDto[]>([]);
  currentUserProfile = signal<ProfileDto | null>(null);
  private readonly http: HttpClient = inject(HttpClient);
  private readonly authState: AuthStateService = inject(AuthStateService);
  private readonly apiBaseUrl: string = inject(API_BASE_URL);

  /** The app scope identifier for this application */
  private readonly appScope = 'client-interface';

  /**
   * Checks if a URL is an external asset URL (not yet stored on the server)
   * @param url The URL to check
   * @returns true if the URL is external (base64 or external URL), false if it's a server asset URL
   */
  private isExternalAssetUrl(url: string | undefined): boolean {
    if (!url) return false;
    return !url.startsWith(`${this.apiBaseUrl}/asset/`);
  }

  /**
   * Extracts the file extension from a data URL
   * @param dataUrl The data URL to extract the extension from
   * @returns The file extension (e.g., 'png', 'jpeg') or empty string if not found
   */
  private getFileExtensionFromDataUrl(dataUrl: string | null | undefined): string {
    if (!dataUrl) return '';
    const matches = dataUrl.match(/^data:(.+?);base64,/);
    if (matches && matches[1]) {
      const mimeType = matches[1];
      const mimeTypeParts = mimeType.split('/');
      if (mimeTypeParts.length === 2) {
        return mimeTypeParts[1]; // Return the file extension part
      }
    }
    return ''; // Return an empty string if no valid extension is found
  }

  /**
   * Checks if a profile is a global profile
   */
  private isGlobalProfile(profile: ProfileDto): boolean {
    return profile.appScope === 'global' || !profile.appScope;
  }

  /**
   * Checks if a profile belongs to the current app scope
   */
  private isLocalProfile(profile: ProfileDto): boolean {
    return profile.appScope === this.appScope;
  }

  /**
   * Gets the local profile for the current app, or falls back to global profile
   */
  getEffectiveProfile(): ProfileDto | null {
    const profiles = this.currentUserProfiles();
    // First try to find a local profile for this app
    const localProfile = profiles.find((p) => this.isLocalProfile(p));
    if (localProfile) {
      return localProfile;
    }
    // Fall back to global profile
    const globalProfile = profiles.find((p) => this.isGlobalProfile(p));
    return globalProfile || null;
  }

  /**
   * Checks if the user has a local profile for this app
   */
  hasLocalProfile(): boolean {
    return this.getCurrentUserProfiles().some((p) => this.isLocalProfile(p));
  }

  /**
   * Checks if the user only has a global profile (no local profile)
   */
  hasOnlyGlobalProfile(): boolean {
    const profiles = this.currentUserProfiles();
    return (
      profiles.some((p) => this.isGlobalProfile(p)) &&
      !profiles.some((p) => this.isLocalProfile(p))
    );
  }

  selectProfile(_p: ProfileDto) {
    const profile = this.currentUserProfiles().find((p) => p.id === _p.id);
    if (profile) {
      this.currentUserProfile.set(profile);
      this.authState.persistSelectedProfile(profile);
    }
  }

  getCurrentUserProfiles() {
    let currentProfiles = this.currentUserProfiles();
    if (!currentProfiles || currentProfiles.length === 0) {
      const persisted = this.authState.getPersistedProfiles();
      if (persisted && persisted.length > 0) {
        this.currentUserProfiles.set(persisted);
        currentProfiles = persisted;
      }
    }
    return currentProfiles;
  }

  getCurrentUserProfile() {
    let currentProfile = this.currentUserProfile();
    if (!currentProfile) {
      currentProfile = this.authState.getPersistedSelectedProfile();
      if (currentProfile) {
        this.currentUserProfile.set(currentProfile);
      }
    }
    return currentProfile;
  }

  async getAllProfiles() {
    const profiles = await firstValueFrom(
      this.http.get<ProfileDto[]>(`${this.apiBaseUrl}/profile`)
    );
    this.allProfiles.set(profiles);
    // Filter profiles for current user that are either global or for this app scope
    const userProfiles = profiles.filter(
      (p) =>
        p.userId === this.authState.getDecodedTokenValue()?.userId &&
        (this.isGlobalProfile(p) || this.isLocalProfile(p))
    );
    this.currentUserProfiles.set(userProfiles);
    this.authState.persistProfiles(this.currentUserProfiles());
  }

  async getProfileById(id: string) {
    const profile = await firstValueFrom(
      this.http.get<ProfileDto>(`${this.apiBaseUrl}/profile/${id}`)
    );
    this.currentUserProfile.set(profile);
    this.authState.persistSelectedProfile(profile);
  }

  async createProfile(profile: CreateProfileDto) {
    const originalProfilePic = profile.profilePic;
    const originalCoverPic = profile.coverPic;
    profile.profilePic = '';
    profile.coverPic = '';
    const tokenValue = this.authState.getDecodedTokenValue();
    if (tokenValue) {
      profile.userId = tokenValue.userId;
    }
    const resp: any = await firstValueFrom(
      this.http.post(`${this.apiBaseUrl}/profile`, profile)
    );
    let newProfile: ProfileDto;
    // If the gateway issued a refreshed token including profileId, it will return { profile, newToken }
    if (resp && resp.newToken) {
      try {
        this.authState.setToken(resp.newToken);
      } catch (e) {
        console.warn('Failed to set new token after profile creation', e);
      }
      newProfile = resp.profile as ProfileDto;
    } else {
      newProfile = resp as ProfileDto;
    }
    let profilePicUrl = '';
    let coverPicUrl = '';

    if (originalProfilePic) {
      const profilePhotoExtension =
        this.getFileExtensionFromDataUrl(originalProfilePic) || 'png';
      const profilePhotoDto: CreateAssetDto = {
        name: `profile-${newProfile.profileName}-photo.${profilePhotoExtension}`,
        profileId: newProfile.id,
        type: 'image',
        content: originalProfilePic,
        fileExtension: profilePhotoExtension,
      };
      const profileAsset = await firstValueFrom(
        this.http.post<AssetDto>(`${this.apiBaseUrl}/asset`, profilePhotoDto)
      );
      profilePicUrl = `${this.apiBaseUrl}/asset/${profileAsset.id}`;
    }

    if (originalCoverPic) {
      const coverPhotoExtension =
        this.getFileExtensionFromDataUrl(originalCoverPic) || 'png';
      const coverPhotoDto: CreateAssetDto = {
        name: `profile-${newProfile.profileName}-cover.${coverPhotoExtension}`,
        profileId: newProfile.id,
        type: 'image',
        content: originalCoverPic,
        fileExtension: coverPhotoExtension,
      };
      const coverAsset = await firstValueFrom(
        this.http.post<AssetDto>(`${this.apiBaseUrl}/asset`, coverPhotoDto)
      );
      coverPicUrl = `${this.apiBaseUrl}/asset/${coverAsset.id}`;
    }

    if (profilePicUrl || coverPicUrl) {
      newProfile.profilePic = profilePicUrl || newProfile.profilePic;
      newProfile.coverPic = coverPicUrl || newProfile.coverPic;
      await firstValueFrom(
        this.http.put<ProfileDto>(`${this.apiBaseUrl}/profile/${newProfile.id}`, {
          profilePic: newProfile.profilePic,
          coverPic: newProfile.coverPic,
        })
      );
    }

    this.currentUserProfiles.update((profiles) => [...profiles, newProfile]);
    this.currentUserProfile.set(newProfile);
    this.authState.persistProfiles(this.currentUserProfiles());
    this.authState.persistSelectedProfile(newProfile);
  }

  /**
   * Updates or creates a profile for the current app scope.
   * If the user only has a global profile, creates a local profile for this app scope.
   */
  async updateProfile(id: string, profile: UpdateProfileDto) {
    // Check if this is a global profile and we need to create a local one
    const existingProfile = this.getCurrentUserProfiles().find((p) => p.id === id);

    if (
      existingProfile &&
      this.isGlobalProfile(existingProfile) &&
      !this.hasLocalProfile()
    ) {
      // User is trying to update a global profile but doesn't have a local one
      // Create a new local profile for this app scope instead
      console.log(
        'Creating local profile from global profile for app scope:',
        this.appScope
      );
      const createDto: CreateProfileDto = {
        name: existingProfile.profileName,
        description: '',
        userId: existingProfile.userId,
        profilePic: profile.profilePic || existingProfile.profilePic,
        coverPic: profile.coverPic || existingProfile.coverPic,
        bio: profile.bio || existingProfile.bio,
        location: profile.location || existingProfile.location,
        occupation: profile.occupation || existingProfile.occupation,
        interests: profile.interests || existingProfile.interests,
        skills: profile.skills || existingProfile.skills,
        appScope: this.appScope,
      };
      await this.createProfile(createDto);
      return;
    }

    if (profile.profilePic && this.isExternalAssetUrl(profile.profilePic)) {
      // Get the original profile to compare the current asset
      const originalProfile = await firstValueFrom(
        this.http.get<ProfileDto>(`${this.apiBaseUrl}/profile/${id}`)
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
      const profilePicExtension =
        this.getFileExtensionFromDataUrl(profile.profilePic || '') || 'png';
      const newProfilePic: CreateAssetDto = {
        name: `profile-${originalProfile.profileName}-photo.${profilePicExtension}`,
        profileId: originalProfile.id,
        type: 'image',
        content: profile.profilePic,
        fileExtension: profilePicExtension,
      };
      const profileAsset = await firstValueFrom(
        this.http.post<AssetDto>(`${this.apiBaseUrl}/asset/`, newProfilePic)
      );
      profile.profilePic = `${this.apiBaseUrl}/asset/${profileAsset.id}`;
    }
    if (profile.coverPic && this.isExternalAssetUrl(profile.coverPic)) {
      const originalProfile = await firstValueFrom(
        this.http.get<ProfileDto>(`${this.apiBaseUrl}/profile/${id}`)
      );
      const originalAssetUrl = originalProfile.coverPic;

      if (originalAssetUrl && originalAssetUrl !== profile.coverPic) {
        const assetId = originalAssetUrl.split('/').pop();
        if (assetId) {
          await firstValueFrom(this.http.delete(originalAssetUrl));
        }
      }
      const coverPicExtension =
        this.getFileExtensionFromDataUrl(profile.coverPic || '') || 'png';
      const newCoverPic: CreateAssetDto = {
        name: `profile-${originalProfile.profileName}-cover.${coverPicExtension}`,
        profileId: originalProfile.id,
        type: 'image',
        content: profile.coverPic,
        fileExtension: coverPicExtension,
      };
      const coverAsset = await firstValueFrom(
        this.http.post<AssetDto>(`${this.apiBaseUrl}/asset/`, newCoverPic)
      );
      profile.coverPic = `${this.apiBaseUrl}/asset/${coverAsset.id}`;
    }
    const updatedProfile = await firstValueFrom(
      this.http.put<ProfileDto>(`${this.apiBaseUrl}/profile/${id}`, profile)
    );
    this.currentUserProfiles.update((profiles) =>
      profiles.map((p) => (p.id === id ? updatedProfile : p))
    );
    this.authState.persistProfiles(this.currentUserProfiles());
    if (this.currentUserProfile()?.id === id) {
      this.currentUserProfile.set(updatedProfile);
      this.authState.persistSelectedProfile(updatedProfile);
    }
  }

  async deleteProfile(id: string) {
    await firstValueFrom(
      this.http.delete<void>(`${this.apiBaseUrl}/profiles/${id}`)
    );
    this.currentUserProfiles.update((profiles) =>
      profiles.filter((p) => p.id !== id)
    );
    this.authState.persistProfiles(this.currentUserProfiles());
    if (this.currentUserProfile()?.id === id) {
      this.currentUserProfile.set(null);
      this.authState.persistSelectedProfile(null);
    }
  }

  loadProfilesFromLocalStorage() {
    const profiles = this.authState.getPersistedProfiles();
    if (profiles) {
      this.currentUserProfiles.set(profiles);
    }
    const selectedProfile = this.authState.getPersistedSelectedProfile();
    if (selectedProfile) {
      this.currentUserProfile.set(selectedProfile);
    }
  }

  persistProfilesToLocalStorage() {
    this.authState.persistProfiles(this.currentUserProfiles());
    this.authState.persistSelectedProfile(this.currentUserProfile());
  }

  getDisplayProfile(id: string) {
    return this.http.get<ProfileDto>(`${this.apiBaseUrl}/profile/${id}`);
  }
}
