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
import { API_BASE_URL } from '@optimistic-tanuki/constants';

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

  selectProfile(_p: ProfileDto) {
    const profile = this.currentUserProfiles().find((p) => p.id === _p.id);
    if (profile) {
      this.currentUserProfile.set(profile);
      this.authState.persistSelectedProfile(profile);
    }
  }

  getCurrentUserProfiles() {
    return this.currentUserProfiles();
  }

  getCurrentUserProfile() {
    return this.currentUserProfile();
  }

  async getAllProfiles() {
    const profiles = await firstValueFrom(
      this.http.get<ProfileDto[]>(`${this.apiBaseUrl}/profile`)
    );
    this.allProfiles.set(profiles);
    this.currentUserProfiles.set(
      profiles.filter(
        (p) => p.userId === this.authState.getDecodedTokenValue()?.userId
      )
    );
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
      this.http.post<AssetDto>(`${this.apiBaseUrl}/asset`, profilePhotoDto)
    );
    const coverAsset = await firstValueFrom(
      this.http.post<AssetDto>(`${this.apiBaseUrl}/asset`, coverPhotoDto)
    );

    newProfile.profilePic = `${this.apiBaseUrl}/asset/${profileAsset.id}`;
    newProfile.coverPic = `${this.apiBaseUrl}/asset/${coverAsset.id}`;
    await firstValueFrom(
      this.http.put<ProfileDto>(`${this.apiBaseUrl}/profile/${newProfile.id}`, {
        profilePic: newProfile.profilePic,
        coverPic: newProfile.coverPic,
      })
    );

    this.currentUserProfiles.update((profiles) => [...profiles, newProfile]);
    this.currentUserProfile.set(newProfile);
    this.authState.persistProfiles(this.currentUserProfiles());
    this.authState.persistSelectedProfile(newProfile);
  }

  async updateProfile(id: string, profile: UpdateProfileDto) {
    if (profile.profilePic && !profile.profilePic.startsWith(`${this.apiBaseUrl}/asset/`)) {
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
      const newProfilePic: CreateAssetDto = {
        name: `profile-${originalProfile.profileName}-photo`,
        profileId: originalProfile.id,
        type: 'image',
        content: profile.profilePic,
      };
      const profileAsset = await firstValueFrom(
        this.http.post<AssetDto>(`${this.apiBaseUrl}/asset/`, newProfilePic)
      );
      profile.profilePic = `${this.apiBaseUrl}/asset/${profileAsset.id}`;
    }
    if (profile.coverPic && !profile.coverPic.startsWith(`${this.apiBaseUrl}/asset/`)) {
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
      const newCoverPic: CreateAssetDto = {
        name: `profile-${originalProfile.profileName}-cover`,
        profileId: originalProfile.id,
        type: 'image',
        content: profile.coverPic,
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
    await firstValueFrom(this.http.delete<void>(`${this.apiBaseUrl}/profiles/${id}`));
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
    return this.http.get<ProfileDto>(`${this.apiBaseUrl}/profile/${id}`).pipe(
      switchMap((profile) =>
        forkJoin({
          profilePic: this.http
            .get<{ profilePic: string }>(`${this.apiBaseUrl}/profile/${id}/photo`)
            .pipe(map((res) => res.profilePic)),
          coverPic: this.http
            .get<{ coverPic: string }>(`${this.apiBaseUrl}/profile/${id}/cover`)
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
