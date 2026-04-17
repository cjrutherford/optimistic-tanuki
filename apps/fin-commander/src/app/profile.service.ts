import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  API_BASE_URL,
  CreateProfileDto,
  ProfileDto,
  UpdateProfileDto,
  AssetDto,
  CreateAssetDto,
} from '@optimistic-tanuki/ui-models';
import { AuthStateService } from './state/auth-state.service';

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  readonly currentUserProfiles = signal<ProfileDto[]>([]);
  readonly currentUserProfile = signal<ProfileDto | null>(null);
  readonly appScope = 'finance';

  private readonly http = inject(HttpClient);
  private readonly authState = inject(AuthStateService);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  private isGlobalProfile(profile: ProfileDto): boolean {
    return profile.appScope === 'global' || !profile.appScope;
  }

  private isLocalProfile(profile: ProfileDto): boolean {
    return profile.appScope === this.appScope;
  }

  private isExternalAssetUrl(url: string | undefined): boolean {
    if (!url) {
      return false;
    }

    return !url.startsWith(`${this.apiBaseUrl}/asset/`);
  }

  private getFileExtensionFromDataUrl(
    dataUrl: string | null | undefined
  ): string {
    if (!dataUrl) {
      return '';
    }

    const matches = dataUrl.match(/^data:(.+?);base64,/);
    if (!matches?.[1]) {
      return '';
    }

    return matches[1].split('/')[1] ?? '';
  }

  getEffectiveProfile(): ProfileDto | null {
    const profiles = this.getCurrentUserProfiles();
    return (
      profiles.find((profile) => this.isLocalProfile(profile)) ??
      profiles.find((profile) => this.isGlobalProfile(profile)) ??
      null
    );
  }

  hasLocalProfile(): boolean {
    return this.getCurrentUserProfiles().some((p) => this.isLocalProfile(p));
  }

  async getAllProfiles(): Promise<void> {
    const profiles = await firstValueFrom(
      this.http.get<ProfileDto[]>(`${this.apiBaseUrl}/profile`)
    );

    const userId = this.authState.getDecodedTokenValue()?.userId;
    const currentProfiles = profiles.filter(
      (profile) =>
        profile.userId === userId &&
        (this.isLocalProfile(profile) || this.isGlobalProfile(profile))
    );
    this.currentUserProfiles.set(currentProfiles);
    this.authState.persistProfiles(currentProfiles);

    const selectedProfile =
      this.getCurrentUserProfile() ?? this.getEffectiveProfile();
    if (selectedProfile) {
      this.currentUserProfile.set(selectedProfile);
      this.authState.persistSelectedProfile(selectedProfile);
    }
  }

  async getProfileById(id: string): Promise<void> {
    const profile = await firstValueFrom(
      this.http.get<ProfileDto>(`${this.apiBaseUrl}/profile/${id}`)
    );
    this.currentUserProfile.set(profile);
    this.authState.persistSelectedProfile(profile);
  }

  getCurrentUserProfiles(): ProfileDto[] {
    const currentProfiles = this.currentUserProfiles();
    if (currentProfiles.length > 0) {
      return currentProfiles;
    }

    const persistedProfiles = this.authState.getPersistedProfiles() ?? [];
    if (persistedProfiles.length > 0) {
      this.currentUserProfiles.set(persistedProfiles);
    }
    return persistedProfiles;
  }

  getCurrentUserProfile(): ProfileDto | null {
    const currentProfile = this.currentUserProfile();
    if (currentProfile) {
      return currentProfile;
    }

    const persistedProfile = this.authState.getPersistedSelectedProfile();
    if (persistedProfile) {
      this.currentUserProfile.set(persistedProfile);
    }
    return persistedProfile;
  }

  selectProfile(profile: ProfileDto): void {
    const selectedProfile =
      this.getCurrentUserProfiles().find((entry) => entry.id === profile.id) ??
      profile;
    this.currentUserProfile.set(selectedProfile);
    this.authState.persistSelectedProfile(selectedProfile);
  }

  async createProfile(profile: CreateProfileDto): Promise<void> {
    const originalProfilePic = profile.profilePic;
    const originalCoverPic = profile.coverPic;
    profile.profilePic = '';
    profile.coverPic = '';
    const tokenValue = this.authState.getDecodedTokenValue();
    if (tokenValue) {
      profile.userId = tokenValue.userId;
    }

    const response = (await firstValueFrom(
      this.http.post(`${this.apiBaseUrl}/profile`, profile)
    )) as ProfileDto | { profile: ProfileDto; newToken?: string };

    let newProfile =
      'profile' in response ? response.profile : (response as ProfileDto);
    if ('newToken' in response && response.newToken) {
      this.authState.setToken(response.newToken);
    }

    if (originalProfilePic) {
      const fileExtension =
        this.getFileExtensionFromDataUrl(originalProfilePic) || 'png';
      const asset = await firstValueFrom(
        this.http.post<AssetDto>(`${this.apiBaseUrl}/asset`, {
          name: `profile-${newProfile.profileName}-photo.${fileExtension}`,
          profileId: newProfile.id,
          type: 'image',
          content: originalProfilePic,
          fileExtension,
        } satisfies CreateAssetDto)
      );
      newProfile = {
        ...newProfile,
        profilePic: `${this.apiBaseUrl}/asset/${asset.id}`,
      };
    }

    if (originalCoverPic) {
      const fileExtension =
        this.getFileExtensionFromDataUrl(originalCoverPic) || 'png';
      const asset = await firstValueFrom(
        this.http.post<AssetDto>(`${this.apiBaseUrl}/asset`, {
          name: `profile-${newProfile.profileName}-cover.${fileExtension}`,
          profileId: newProfile.id,
          type: 'image',
          content: originalCoverPic,
          fileExtension,
        } satisfies CreateAssetDto)
      );
      newProfile = {
        ...newProfile,
        coverPic: `${this.apiBaseUrl}/asset/${asset.id}`,
      };
    }

    if (newProfile.profilePic || newProfile.coverPic) {
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

  async updateProfile(id: string, profile: UpdateProfileDto): Promise<void> {
    if (profile.profilePic && this.isExternalAssetUrl(profile.profilePic)) {
      const existing = await firstValueFrom(
        this.http.get<ProfileDto>(`${this.apiBaseUrl}/profile/${id}`)
      );
      const fileExtension =
        this.getFileExtensionFromDataUrl(profile.profilePic) || 'png';
      const asset = await firstValueFrom(
        this.http.post<AssetDto>(`${this.apiBaseUrl}/asset`, {
          name: `profile-${existing.profileName}-photo.${fileExtension}`,
          profileId: existing.id,
          type: 'image',
          content: profile.profilePic,
          fileExtension,
        } satisfies CreateAssetDto)
      );
      profile.profilePic = `${this.apiBaseUrl}/asset/${asset.id}`;
    }

    if (profile.coverPic && this.isExternalAssetUrl(profile.coverPic)) {
      const existing = await firstValueFrom(
        this.http.get<ProfileDto>(`${this.apiBaseUrl}/profile/${id}`)
      );
      const fileExtension =
        this.getFileExtensionFromDataUrl(profile.coverPic) || 'png';
      const asset = await firstValueFrom(
        this.http.post<AssetDto>(`${this.apiBaseUrl}/asset`, {
          name: `profile-${existing.profileName}-cover.${fileExtension}`,
          profileId: existing.id,
          type: 'image',
          content: profile.coverPic,
          fileExtension,
        } satisfies CreateAssetDto)
      );
      profile.coverPic = `${this.apiBaseUrl}/asset/${asset.id}`;
    }

    const updated = await firstValueFrom(
      this.http.put<ProfileDto>(`${this.apiBaseUrl}/profile/${id}`, profile)
    );

    this.currentUserProfiles.update((profiles) =>
      profiles.map((entry) => (entry.id === updated.id ? updated : entry))
    );
    this.currentUserProfile.set(updated);
    this.authState.persistProfiles(this.currentUserProfiles());
    this.authState.persistSelectedProfile(updated);
  }
}
