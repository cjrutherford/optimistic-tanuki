import { HttpClient } from '@angular/common/http';
import { Injectable, signal, inject } from '@angular/core';
import {
  ProfileDto,
  CreateProfileDto,
  UpdateProfileDto,
} from '@optimistic-tanuki/ui-models';
import { firstValueFrom } from 'rxjs';
import { AuthStateService } from './auth-state.service';
import { API_BASE_URL } from '../types';

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  currentUserProfiles = signal<ProfileDto[]>([]);
  currentUserProfile = signal<ProfileDto | null>(null);
  private readonly http: HttpClient = inject(HttpClient);
  private readonly authState: AuthStateService = inject(AuthStateService);
  private readonly apiBaseUrl: string = inject(API_BASE_URL);

  private readonly appScope = 'd6';

  private isGlobalProfile(profile: ProfileDto): boolean {
    return profile.appScope === 'global' || !profile.appScope;
  }

  private isLocalProfile(profile: ProfileDto): boolean {
    return profile.appScope === this.appScope;
  }

  getEffectiveProfile(): ProfileDto | null {
    const profiles = this.currentUserProfiles();
    const localProfile = profiles.find((p) => this.isLocalProfile(p));
    if (localProfile) {
      return localProfile;
    }
    const globalProfile = profiles.find((p) => this.isGlobalProfile(p));
    return globalProfile || null;
  }

  hasLocalProfile(): boolean {
    return this.getCurrentUserProfiles().some((p) => this.isLocalProfile(p));
  }

  selectProfile(profile: ProfileDto): void {
    const existing = this.currentUserProfiles().find(
      (p) => p.id === profile.id
    );
    if (existing) {
      this.currentUserProfile.set(existing);
      this.authState.persistSelectedProfile(existing);
    }
  }

  getCurrentUserProfiles(): ProfileDto[] {
    let currentProfiles = this.currentUserProfiles();
    if (!currentProfiles || currentProfiles.length === 0) {
      const persisted = this.authState.getPersistedSelectedProfile();
      if (persisted) {
        this.currentUserProfiles.set([persisted]);
        currentProfiles = [persisted];
      }
    }
    return currentProfiles;
  }

  getCurrentUserProfile(): ProfileDto | null {
    let currentProfile = this.currentUserProfile();
    if (!currentProfile) {
      currentProfile = this.authState.getPersistedSelectedProfile();
      if (currentProfile) {
        this.currentUserProfile.set(currentProfile);
      }
    }
    return currentProfile;
  }

  async getAllProfiles(): Promise<ProfileDto[]> {
    const profiles = await firstValueFrom(
      this.http.get<ProfileDto[]>(`${this.apiBaseUrl}/profile`)
    );
    const userId = this.authState.getDecodedTokenValue()?.userId;
    const userProfiles = profiles.filter(
      (p) =>
        p.userId === userId &&
        (this.isGlobalProfile(p) || this.isLocalProfile(p))
    );
    this.currentUserProfiles.set(userProfiles);
    return userProfiles;
  }

  async getProfileById(id: string): Promise<ProfileDto> {
    const profile = await firstValueFrom(
      this.http.get<ProfileDto>(`${this.apiBaseUrl}/profile/${id}`)
    );
    this.currentUserProfile.set(profile);
    this.authState.persistSelectedProfile(profile);
    return profile;
  }

  async createProfile(profile: CreateProfileDto): Promise<ProfileDto> {
    const tokenValue = this.authState.getDecodedTokenValue();
    if (tokenValue) {
      profile.userId = tokenValue.userId;
    }
    const resp: any = await firstValueFrom(
      this.http.post(`${this.apiBaseUrl}/profile`, profile)
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
    this.currentUserProfiles.update((profiles) => [...profiles, newProfile]);
    this.currentUserProfile.set(newProfile);
    this.authState.persistSelectedProfile(newProfile);
    return newProfile;
  }

  async updateProfile(
    id: string,
    profile: UpdateProfileDto
  ): Promise<ProfileDto> {
    const updatedProfile = await firstValueFrom(
      this.http.put<ProfileDto>(`${this.apiBaseUrl}/profile/${id}`, profile)
    );
    this.currentUserProfiles.update((profiles) =>
      profiles.map((p) => (p.id === id ? updatedProfile : p))
    );
    if (this.currentUserProfile()?.id === id) {
      this.currentUserProfile.set(updatedProfile);
      this.authState.persistSelectedProfile(updatedProfile);
    }
    return updatedProfile;
  }

  async deleteProfile(id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`${this.apiBaseUrl}/profiles/${id}`)
    );
    this.currentUserProfiles.update((profiles) =>
      profiles.filter((p) => p.id !== id)
    );
    if (this.currentUserProfile()?.id === id) {
      this.currentUserProfile.set(null);
      this.authState.persistSelectedProfile(null);
    }
  }
}
