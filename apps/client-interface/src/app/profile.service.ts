import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { ProfileDto, CreateProfileDto, UpdateProfileDto, AssetDto, CreateAssetDto } from '@optimistic-tanuki/ui-models';
import { firstValueFrom, map, switchMap, forkJoin } from 'rxjs';
import { AuthStateService } from './state/auth-state.service';

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
    // for(const p of profiles) {
    //   const pic = await firstValueFrom(this.http.get<{profilePic: string}>(`/api/profile/${p.id}/photo`));
    //   p.profilePic = pic.profilePic;
    //   const cover = await firstValueFrom(this.http.get<{coverPic: string}>(`/api/profile/${p.id}/cover`));
    //   p.coverPic = cover.coverPic
    //   if (p.id === this.currentUserProfile()?.id) {
    //     this.currentUserProfile.set(p);
    //   }
    // }
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
      `/api/assets/}`, 
      profilePhotoDto,
    ));
    const coverAsset = await firstValueFrom(this.http.post<AssetDto>(`/api/assets/`, coverPhotoDto));

    newProfile.profilePic = `/api/assets/${profileAsset.id}`;
    newProfile.coverPic = `/api/assets/${coverAsset.id}`;
    await firstValueFrom(this.http.put<ProfileDto>(`/api/profiles/${newProfile.id}`, {
      profilePic: newProfile.profilePic,
      coverPic: newProfile.coverPic
    }));
    
    this.currentUserProfiles.update(profiles => [...profiles, newProfile]);
    localStorage.setItem('profiles', JSON.stringify(this.currentUserProfiles()));
  }

  async updateProfile(id: string, profile: UpdateProfileDto) {
    const updatedProfile = await firstValueFrom(this.http.put<ProfileDto>(`/api/profiles/${id}`, profile));
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

