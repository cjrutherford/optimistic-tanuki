import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  CreateProfileDto,
  ProfileDto,
  UpdateProfileDto,
} from '@optimistic-tanuki/ui-models';
import { firstValueFrom } from 'rxjs';
import { AuthStateService } from './auth-state.service';

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  currentUserProfiles = signal<ProfileDto[]>([]);
  currentUserProfile = signal<ProfileDto | null>(null);

  private readonly appScope = 'system-configurator';
  private readonly http = inject(HttpClient);
  private readonly authState = inject(AuthStateService);

  async getAllProfiles(): Promise<void> {
    const profiles = await firstValueFrom(
      this.http.get<ProfileDto[]>('/api/profile')
    );
    const userId = this.authState.getDecodedTokenValue()?.userId;
    const scopedProfiles = profiles.filter(
      (profile) =>
        profile.userId === userId &&
        (profile.appScope === this.appScope ||
          profile.appScope === 'global' ||
          !profile.appScope)
    );

    this.currentUserProfiles.set(scopedProfiles);
    this.authState.persistProfiles(scopedProfiles);
  }

  getCurrentUserProfiles(): ProfileDto[] {
    const current = this.currentUserProfiles();
    if (current.length > 0) {
      return current;
    }

    const persisted = this.authState.getPersistedProfiles();
    if (persisted) {
      this.currentUserProfiles.set(persisted);
      return persisted;
    }

    return [];
  }

  getEffectiveProfile(): ProfileDto | null {
    const selected =
      this.currentUserProfile() || this.authState.getPersistedSelectedProfile();
    if (selected) {
      this.currentUserProfile.set(selected);
      return selected;
    }

    const profiles = this.getCurrentUserProfiles();
    const local = profiles.find(
      (profile) => profile.appScope === this.appScope
    );
    if (local) {
      return local;
    }

    const global = profiles.find(
      (profile) => profile.appScope === 'global' || !profile.appScope
    );
    return global || null;
  }

  selectProfile(profile: ProfileDto): void {
    this.currentUserProfile.set(profile);
    this.authState.persistSelectedProfile(profile);
  }

  async createProfile(profile: CreateProfileDto): Promise<ProfileDto> {
    const tokenValue = this.authState.getDecodedTokenValue();
    const response = await firstValueFrom(
      this.http.post<ProfileDto | { profile: ProfileDto; newToken?: string }>(
        '/api/profile',
        {
          ...profile,
          userId: tokenValue?.userId || profile.userId,
          appScope: this.appScope,
          appId: this.appScope,
          profilePic: profile.profilePic || '',
          coverPic: profile.coverPic || '',
        }
      )
    );

    const created = 'profile' in response ? response.profile : response;
    if ('newToken' in response && response.newToken) {
      this.authState.setToken(response.newToken);
    }

    const profiles = [...this.getCurrentUserProfiles(), created];
    this.currentUserProfiles.set(profiles);
    this.authState.persistProfiles(profiles);
    this.selectProfile(created);
    return created;
  }

  async updateProfile(
    id: string,
    profile: UpdateProfileDto
  ): Promise<ProfileDto> {
    const updated = await firstValueFrom(
      this.http.put<ProfileDto>(`/api/profile/${id}`, profile)
    );
    const profiles = this.getCurrentUserProfiles().map((current) =>
      current.id === updated.id ? updated : current
    );
    this.currentUserProfiles.set(profiles);
    this.authState.persistProfiles(profiles);
    this.selectProfile(updated);
    return updated;
  }
}
