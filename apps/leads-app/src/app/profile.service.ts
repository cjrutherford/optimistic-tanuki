import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  API_BASE_URL,
  CreateProfileDto,
  ProfileDto,
  UpdateProfileDto,
} from '@optimistic-tanuki/ui-models';
import { firstValueFrom } from 'rxjs';
import { AuthStateService } from './auth-state.service';
import { AuthenticationService } from './authentication.service';

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly authState = inject(AuthStateService);
  private readonly authenticationService = inject(AuthenticationService);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly appScope = 'leads-app';

  readonly currentUserProfiles = signal<ProfileDto[]>([]);
  readonly allProfiles = signal<ProfileDto[]>([]);
  readonly currentUserProfile = signal<ProfileDto | null>(null);

  getEffectiveProfile(): ProfileDto | null {
    const profiles = this.getCurrentUserProfiles();
    const localProfile = profiles.find((profile) => this.isLocalProfile(profile));
    if (localProfile) {
      return localProfile;
    }

    const globalProfile = profiles.find((profile) => this.isGlobalProfile(profile));
    return globalProfile || null;
  }

  hasLocalProfile(): boolean {
    return this.getCurrentUserProfiles().some((profile) =>
      this.isLocalProfile(profile)
    );
  }

  selectProfile(profile: ProfileDto) {
    const matchingProfile = this
      .getCurrentUserProfiles()
      .find((candidate) => candidate.id === profile.id);

    if (matchingProfile) {
      this.currentUserProfile.set(matchingProfile);
      this.authState.persistSelectedProfile(matchingProfile);
    }
  }

  async activateProfile(profile: ProfileDto): Promise<void> {
    this.selectProfile(profile);

    const matchingProfile = this.getCurrentUserProfile();
    if (!matchingProfile) {
      return;
    }

    const tokenProfileId = this.authState.getDecodedTokenValue()?.profileId || '';
    if (tokenProfileId === matchingProfile.id) {
      return;
    }

    const response = await this.authenticationService.issue({
      profileId: matchingProfile.id,
    });
    const newToken = response?.data?.newToken;
    if (newToken) {
      this.authState.setToken(newToken);
    }
  }

  getCurrentUserProfiles(): ProfileDto[] {
    let profiles = this.currentUserProfiles();
    if (!profiles.length) {
      const persisted = this.authState.getPersistedProfiles();
      if (persisted?.length) {
        this.currentUserProfiles.set(persisted);
        profiles = persisted;
      }
    }
    return profiles;
  }

  getCurrentUserProfile(): ProfileDto | null {
    let profile = this.currentUserProfile();
    if (!profile) {
      profile = this.authState.getPersistedSelectedProfile();
      if (profile) {
        this.currentUserProfile.set(profile);
      }
    }
    return profile;
  }

  async getAllProfiles(): Promise<ProfileDto[]> {
    const profiles = await firstValueFrom(
      this.http.get<ProfileDto[]>(`${this.apiBaseUrl}/profile`)
    );
    this.allProfiles.set(profiles);

    const userProfiles = profiles.filter(
      (profile) =>
        profile.userId === this.authState.getDecodedTokenValue()?.userId &&
        (this.isGlobalProfile(profile) || this.isLocalProfile(profile))
    );

    this.currentUserProfiles.set(userProfiles);
    this.authState.persistProfiles(userProfiles);

    const selected = this.authState.getPersistedSelectedProfile();
    if (selected) {
      this.selectProfile(selected);
    } else {
      const effectiveProfile =
        userProfiles.find((profile) => this.isLocalProfile(profile)) || null;
      if (effectiveProfile) {
        this.selectProfile(effectiveProfile);
      }
    }

    return userProfiles;
  }

  async createProfile(profile: CreateProfileDto): Promise<ProfileDto> {
    const token = this.authState.getDecodedTokenValue();
    const response: any = await firstValueFrom(
      this.http.post(`${this.apiBaseUrl}/profile`, {
        ...profile,
        userId: token?.userId,
        appScope: this.appScope,
      })
    );

    const createdProfile = (response.profile || response) as ProfileDto;
    if (response.newToken) {
      this.authState.setToken(response.newToken);
    }

    this.currentUserProfiles.update((profiles) => {
      const deduped = profiles.filter(
        (existingProfile) => existingProfile.id !== createdProfile.id
      );
      return [...deduped, createdProfile];
    });
    this.currentUserProfile.set(createdProfile);
    this.authState.persistProfiles(this.currentUserProfiles());
    this.authState.persistSelectedProfile(createdProfile);

    return createdProfile;
  }

  async updateProfile(id: string, profile: UpdateProfileDto): Promise<ProfileDto> {
    const updatedProfile = await firstValueFrom(
      this.http.put<ProfileDto>(`${this.apiBaseUrl}/profile/${id}`, profile)
    );

    this.currentUserProfiles.update((profiles) =>
      profiles.map((existingProfile) =>
        existingProfile.id === id ? updatedProfile : existingProfile
      )
    );

    if (this.currentUserProfile()?.id === id) {
      this.currentUserProfile.set(updatedProfile);
      this.authState.persistSelectedProfile(updatedProfile);
    }

    this.authState.persistProfiles(this.currentUserProfiles());
    return updatedProfile;
  }

  private isGlobalProfile(profile: ProfileDto): boolean {
    return profile.appScope === 'global' || !profile.appScope;
  }

  private isLocalProfile(profile: ProfileDto): boolean {
    return profile.appScope === this.appScope;
  }
}
