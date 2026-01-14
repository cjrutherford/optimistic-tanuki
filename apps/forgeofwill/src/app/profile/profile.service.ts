import {
  AssetDto,
  CreateAssetDto,
  CreateProfileDto,
  ProfileDto,
  UpdateProfileDto,
} from '@optimistic-tanuki/ui-models';
import { Injectable, signal } from '@angular/core';
import { firstValueFrom, forkJoin, map, switchMap } from 'rxjs';

import { AuthStateService } from '../auth-state.service';
import { HttpClient } from '@angular/common/http';
import { UpdateAttachmentDto } from '@optimistic-tanuki/social-ui';

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  currentUserProfiles = signal<ProfileDto[]>([]);
  allProfiles = signal<ProfileDto[]>([]);
  currentUserProfile = signal<ProfileDto | null>(null);

  /** The app scope identifier for this application */
  private readonly appScope = 'forgeofwill';

  constructor(
    private readonly http: HttpClient,
    private readonly authState: AuthStateService
  ) {}

  selectProfile(_p: ProfileDto) {
    console.log('Selecting profile:', _p);
    const profile = this.currentUserProfiles().find((p) => p.id === _p.id);
    if (profile) {
      this.currentUserProfile.set(profile);
      localStorage.setItem('selectedProfile', JSON.stringify(profile));
    } else {
      console.warn('New Profile being added to the list');
      this.currentUserProfiles.update((profiles) => [...profiles, _p]);
      this.currentUserProfile.set(_p);
      localStorage.setItem('selectedProfile', JSON.stringify(_p));
      localStorage.setItem(
        'profiles',
        JSON.stringify(this.currentUserProfiles())
      );
    }
  }

  getCurrentUserProfiles() {
    let currentProfiles = this.currentUserProfiles();
    if (!currentProfiles || currentProfiles.length === 0) {
      // fallback to local storage if no profiles are selected
      const storedProfiles = localStorage.getItem('profiles');
      if (storedProfiles) {
        const profiles = JSON.parse(storedProfiles) as ProfileDto[];
        this.currentUserProfiles.set(profiles);
        currentProfiles = profiles;
      }
    }
    return currentProfiles;
  }

  getCurrentUserProfile() {
    let currentProfile = this.currentUserProfile();
    if (!currentProfile) {
      // Try to restore from localStorage
      const storedProfile = localStorage.getItem('selectedProfile');
      if (storedProfile) {
        currentProfile = JSON.parse(storedProfile) as ProfileDto;
        this.currentUserProfile.set(currentProfile);
      } else {
        // Fallback: select the first available profile
        const profiles = this.getCurrentUserProfiles();
        if (profiles.length > 0) {
          currentProfile = profiles[0];
          this.currentUserProfile.set(currentProfile);
          this.selectProfile(currentProfile);
          localStorage.setItem(
            'selectedProfile',
            JSON.stringify(currentProfile)
          );
        }
      }
    }
    return currentProfile;
  }

  async getAllProfiles() {
    const profiles = await firstValueFrom(
      this.http.get<ProfileDto[]>('/api/profile')
    );
    this.allProfiles.set(profiles);
    // Filter profiles for current user that are either global or for this app scope
    const userProfiles = profiles.filter(
      (p) =>
        p.userId === this.authState.getDecodedTokenValue()?.userId &&
        (this.isGlobalProfile(p) || this.isLocalProfile(p))
    );
    this.currentUserProfiles.set(userProfiles);
    localStorage.setItem('profiles', JSON.stringify(userProfiles));
  }

  async getProfileById(id: string) {
    const profile = await firstValueFrom(
      this.http.get<ProfileDto>(`/api/profile/${id}`)
    );
    this.currentUserProfile.set(profile);
    localStorage.setItem('selectedProfile', JSON.stringify(profile));
  }

  getFileExtensionFromDataUrl(dataUrl: string | null | undefined): string {
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
    return this.currentUserProfiles().some((p) => this.isLocalProfile(p));
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
      this.http.post('/api/profile', {
        ...profile,
        appId: 'forgeofwill',
      })
    );
    let newProfile: ProfileDto;
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
        this.http.post<AssetDto>(`/api/asset`, profilePhotoDto)
      );
      profilePicUrl = `/api/asset/${profileAsset.id}`;
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
        this.http.post<AssetDto>(`/api/asset`, coverPhotoDto)
      );
      coverPicUrl = `/api/asset/${coverAsset.id}`;
    }

    if (profilePicUrl || coverPicUrl) {
      newProfile.profilePic = profilePicUrl || newProfile.profilePic;
      newProfile.coverPic = coverPicUrl || newProfile.coverPic;
      await firstValueFrom(
        this.http.put<ProfileDto>(`/api/profile/${newProfile.id}`, {
          profilePic: newProfile.profilePic,
          coverPic: newProfile.coverPic,
        })
      );
    }

    this.currentUserProfiles.update((profiles) => [...profiles, newProfile]);
    localStorage.setItem(
      'profiles',
      JSON.stringify(this.currentUserProfiles())
    );
  }

  /**
   * Updates or creates a profile for the current app scope.
   * If the user only has a global profile, creates a local profile for this app scope.
   */
  async updateProfile(id: string, profile: UpdateProfileDto) {
    // Check if this is a global profile and we need to create a local one
    const existingProfile = this.getCurrentUserProfiles().find(
      (p) => p.id === id
    );

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
          try {
            await firstValueFrom(this.http.delete(originalAssetUrl));
          } catch (error) {
            console.warn('Error deleting asset:', error);
          }
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
          try {
            await firstValueFrom(this.http.delete(originalAssetUrl));
          } catch (error) {
            console.warn('Error deleting asset:', error);
          }
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
    localStorage.setItem(
      'profiles',
      JSON.stringify(this.currentUserProfiles())
    );
    if (this.currentUserProfile()?.id === id) {
      this.currentUserProfile.set(updatedProfile);
      localStorage.setItem('selectedProfile', JSON.stringify(updatedProfile));
    }
  }

  async deleteProfile(id: string) {
    await firstValueFrom(this.http.delete<void>(`/api/profiles/${id}`));
    this.currentUserProfiles.update((profiles) =>
      profiles.filter((p) => p.id !== id)
    );
    localStorage.setItem(
      'profiles',
      JSON.stringify(this.currentUserProfiles())
    );
    if (this.currentUserProfile()?.id === id) {
      this.currentUserProfile.set(null);
      localStorage.removeItem('selectedProfile');
    }
  }

  loadProfilesFromLocalStorage() {
    const profiles = localStorage.getItem('profiles');
    if (profiles) {
      this.currentUserProfiles.set(JSON.parse(profiles));
    }
    const selectedProfile = localStorage.getItem('selectedProfile');
    if (selectedProfile) {
      this.currentUserProfile.set(JSON.parse(selectedProfile));
      this.selectProfile(JSON.parse(selectedProfile) as ProfileDto);
    }
  }

  persistProfilesToLocalStorage() {
    localStorage.setItem(
      'profiles',
      JSON.stringify(this.currentUserProfiles())
    );
    localStorage.setItem(
      'selectedProfile',
      JSON.stringify(this.currentUserProfile())
    );
  }

  getDisplayProfile(id: string) {
    return this.http.get<ProfileDto>(`/api/profile/${id}`);
  }
}
