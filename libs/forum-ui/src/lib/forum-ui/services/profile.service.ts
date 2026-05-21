import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthStateService } from './auth-state.service';

export interface UserProfile {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  email: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private readonly baseUrl = '/api/profile';

  constructor(
    private http: HttpClient,
    private authState: AuthStateService
  ) {}

  getCurrentUserProfile(): UserProfile | null {
    const user = this.authState.getCurrentUser();
    if (!user) return null;
    
    // Return a mock profile based on the current user token
    // In a real app, this would fetch from the profile service
    return {
      id: user.profileId || user.sub || '',
      userId: user.userId || user.sub || '',
      username: user.preferred_username || user.email || 'user',
      displayName: user.name || user.preferred_username || user.email || 'User',
      email: user.email || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async getUserProfile(userId: string): Promise<UserProfile> {
    return this.http.get<UserProfile>(`${this.baseUrl}/users/${userId}`).toPromise() as Promise<UserProfile>;
  }

  async updateProfile(profileId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    return this.http.put<UserProfile>(`${this.baseUrl}/${profileId}`, updates).toPromise() as Promise<UserProfile>;
  }
}