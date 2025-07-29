import { AssetDto, CreateAssetDto, CreateProfileDto, ProfileDto, UpdateProfileDto } from '@optimistic-tanuki/ui-models';
import { Injectable, signal } from '@angular/core';
import { firstValueFrom, forkJoin, map, switchMap } from 'rxjs';

import { AuthStateService } from '../auth-state.service';
import { HttpClient } from '@angular/common/http';
import { UpdateAttachmentDto } from '@optimistic-tanuki/social-ui';

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  currentUserProfiles = signal<ProfileDto[]>([]);
  allProfiles = signal<ProfileDto[]>([]);
  currentUserProfile = signal<ProfileDto | null>(null);
  constructor(private readonly http: HttpClient, private readonly authState: AuthStateService) { }

  selectProfile(_p: ProfileDto) {
    const profile = this.currentUserProfiles().find(p => p.id === _p.id);
    if (profile) {
      this.currentUserProfile.set(profile);
      localStorage.setItem('selectedProfile', JSON.stringify(profile));
    }
  }

  getCurrentUserProfiles() {
    return this.currentUserProfiles();
  }

  getCurrentUserProfile() {
    return this.currentUserProfile();
  }

  async getAllProfiles() {
    const profiles = await firstValueFrom(this.http.get<ProfileDto[]>('/api/profile'));
    this.allProfiles.set(profiles);
    this.currentUserProfiles.set(profiles.filter(p => p.userId === this.authState.getDecodedTokenValue()?.userId));
    localStorage.setItem('profiles', JSON.stringify(profiles));
  }

  async getProfileById(id: string) {
    const profile = await firstValueFrom(this.http.get<ProfileDto>(`/api/profile/${id}`));
    this.currentUserProfile.set(profile);
    localStorage.setItem('selectedProfile', JSON.stringify(profile));
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
    const newProfile = await firstValueFrom(this.http.post<ProfileDto>('/api/profile', profile));
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
    const profileAsset = await firstValueFrom(this.http.post<AssetDto>(
      `/api/asset`, 
      profilePhotoDto,
    ));
    const coverAsset = await firstValueFrom(this.http.post<AssetDto>(
      `/api/asset`, 
      coverPhotoDto
    ));

    newProfile.profilePic = `/api/asset/${profileAsset.id}`;
    newProfile.coverPic = `/api/asset/${coverAsset.id}`;
    await firstValueFrom(this.http.put<ProfileDto>(`/api/profile/${newProfile.id}`, {
      profilePic: newProfile.profilePic,
      coverPic: newProfile.coverPic
    }));
    
    this.currentUserProfiles.update(profiles => [...profiles, newProfile]);
    localStorage.setItem('profiles', JSON.stringify(this.currentUserProfiles()));
  }

  async updateProfile(id: string, profile: UpdateProfileDto) {
    if (profile.profilePic && !profile.profilePic.startsWith('/api/asset/')) {
      // Get the original profile to compare the current asset
      const originalProfile = await firstValueFrom(this.http.get<ProfileDto>(`/api/profile/${id}`));
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
      const profileAsset = await firstValueFrom(this.http.post<AssetDto>('/api/asset/', newProfilePic));
      profile.profilePic = `/api/asset/${profileAsset.id}`;
    }
    if(profile.coverPic && !profile.coverPic.startsWith('/api/asset/')) {
      const originalProfile = await firstValueFrom(this.http.get<ProfileDto>(`/api/profile/${id}`));
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
      const coverAsset = await firstValueFrom(this.http.post<AssetDto>('/api/asset/', newCoverPic));
      profile.coverPic = `/api/asset/${coverAsset.id}`;
    }
    const updatedProfile = await firstValueFrom(this.http.put<ProfileDto>(`/api/profile/${id}`, profile));
    this.currentUserProfiles.update(profiles => profiles.map(p => p.id === id ? updatedProfile : p));
    localStorage.setItem('profiles', JSON.stringify(this.currentUserProfiles()));
    if (this.currentUserProfile()?.id === id) {
      this.currentUserProfile.set(updatedProfile);
      localStorage.setItem('selectedProfile', JSON.stringify(updatedProfile));
    }
  }

  async deleteProfile(id: string) {
    await firstValueFrom(this.http.delete<void>(`/api/profiles/${id}`));
    this.currentUserProfiles.update(profiles => profiles.filter(p => p.id !== id));
    localStorage.setItem('profiles', JSON.stringify(this.currentUserProfiles()));
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
    }
  }

  persistProfilesToLocalStorage() {
    localStorage.setItem('profiles', JSON.stringify(this.currentUserProfiles()));
    localStorage.setItem('selectedProfile', JSON.stringify(this.currentUserProfile()));
  }


  getDisplayProfile(id: string) {
    return this.http.get<ProfileDto>(`/api/profile/${id}`).pipe(
      switchMap(profile =>
      forkJoin({
        profilePic: this.http.get<{ profilePic: string }>(`/api/profile/${id}/photo`).pipe(map(res => res.profilePic)),
        coverPic: this.http.get<{ coverPic: string }>(`/api/profile/${id}/cover`).pipe(map(res => res.coverPic))
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

