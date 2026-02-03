import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { ProfileDto } from '@optimistic-tanuki/ui-models';

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private readonly http = inject(HttpClient);
  private currentProfileSubject = new BehaviorSubject<ProfileDto | null>(null);
  private profilesSubject = new BehaviorSubject<ProfileDto[]>([]);

  public currentProfile$ = this.currentProfileSubject.asObservable();
  public profiles$ = this.profilesSubject.asObservable();

  async getAllProfiles(): Promise<ProfileDto[]> {
    const profiles = await firstValueFrom(
      this.http.get<ProfileDto[]>('/api/profile')
    );
    this.profilesSubject.next(profiles);
    return profiles;
  }

  async getProfileById(id: string): Promise<ProfileDto> {
    return firstValueFrom(
      this.http.get<ProfileDto>(`/api/profile/${id}`)
    );
  }

  async createProfile(profile: Partial<ProfileDto>): Promise<ProfileDto> {
    const newProfile = await firstValueFrom(
      this.http.post<ProfileDto>('/api/profile', profile)
    );
    const profiles = this.profilesSubject.value;
    this.profilesSubject.next([...profiles, newProfile]);
    return newProfile;
  }

  async updateProfile(id: string, profile: Partial<ProfileDto>): Promise<ProfileDto> {
    const updatedProfile = await firstValueFrom(
      this.http.put<ProfileDto>(`/api/profile/${id}`, profile)
    );
    const profiles = this.profilesSubject.value.map(p => 
      p.id === id ? updatedProfile : p
    );
    this.profilesSubject.next(profiles);
    if (this.currentProfileSubject.value?.id === id) {
      this.currentProfileSubject.next(updatedProfile);
    }
    return updatedProfile;
  }

  selectProfile(profile: ProfileDto): void {
    this.currentProfileSubject.next(profile);
    localStorage.setItem('selectedProfile', JSON.stringify(profile));
  }

  getCurrentUserProfile(): ProfileDto | null {
    return this.currentProfileSubject.value;
  }

  getCurrentUserProfiles(): ProfileDto[] {
    return this.profilesSubject.value;
  }

  loadStoredProfile(): void {
    const stored = localStorage.getItem('selectedProfile');
    if (stored) {
      try {
        const profile = JSON.parse(stored);
        this.currentProfileSubject.next(profile);
      } catch (error) {
        console.error('Error loading stored profile:', error);
      }
    }
  }
}
