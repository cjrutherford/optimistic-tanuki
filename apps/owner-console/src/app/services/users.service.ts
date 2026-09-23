import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { OptomisitcTanukiAPIService } from '@optimistic-tanuki/profile-ui-data-access';

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private readonly profiles = inject(OptomisitcTanukiAPIService);

  getProfiles(): Observable<ProfileDto[]> {
    return this.profiles.profileControllerGetAllProfiles<ProfileDto[]>();
  }

  getProfile(id: string): Observable<ProfileDto> {
    // Canonical read (by-id adds telos back-fill); the legacy :id route stays.
    return this.profiles.profileControllerGetProfileById<ProfileDto>(id);
  }

  updateProfile(
    id: string,
    profile: Partial<ProfileDto>
  ): Observable<ProfileDto> {
    return this.profiles.profileControllerUpdateProfile<ProfileDto>(
      id,
      profile
    );
  }
}
