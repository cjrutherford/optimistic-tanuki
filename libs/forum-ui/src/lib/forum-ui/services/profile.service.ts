import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthStateService } from './auth-state.service';
import { OptomisitcTanukiAPIService } from '@optimistic-tanuki/profile-ui-data-access';

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
  providedIn: 'root',
})
export class ProfileService {
  private readonly profiles = inject(OptomisitcTanukiAPIService);

  constructor(private authState: AuthStateService) {}

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

  // NOTE: getUserProfile (GET /api/profile/users/:id) was removed — the
  // route never existed and nothing called it.

  async updateProfile(
    profileId: string,
    updates: Partial<UserProfile>
  ): Promise<UserProfile> {
    return firstValueFrom(
      this.profiles.profileControllerUpdateProfile<UserProfile>(
        profileId,
        updates
      )
    );
  }
}
