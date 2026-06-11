import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProfileDto, ProfileTelosDto } from '@optimistic-tanuki/ui-models';

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private readonly API_URL = '/api/profile';

  constructor(private http: HttpClient) {}

  getProfiles(): Observable<ProfileDto[]> {
    return this.http.get<ProfileDto[]>(`${this.API_URL}`);
  }

  getProfile(id: string): Observable<ProfileDto> {
    return this.http.get<ProfileDto>(`${this.API_URL}/${id}`);
  }

  updateProfile(
    id: string,
    profile: Partial<ProfileDto>
  ): Observable<ProfileDto> {
    return this.http.put<ProfileDto>(`${this.API_URL}/${id}`, profile);
  }

  getProfileTelos(id: string): Observable<ProfileTelosDto | null> {
    return this.http.get<ProfileTelosDto | null>(`${this.API_URL}/${id}/telos`);
  }

  regenerateProfileTelos(id: string): Observable<ProfileTelosDto | null> {
    return this.http.post<ProfileTelosDto | null>(
      `${this.API_URL}/${id}/telos/regenerate`,
      {}
    );
  }

  regenerateProfileTelosBulk(
    profileIds: string[]
  ): Observable<Array<ProfileTelosDto | null>> {
    return this.http.post<Array<ProfileTelosDto | null>>(
      `${this.API_URL}/telos/regenerate-bulk`,
      { profileIds }
    );
  }

  resetProfileTelos(id: string): Observable<ProfileTelosDto | null> {
    return this.http.delete<ProfileTelosDto | null>(
      `${this.API_URL}/${id}/telos`
    );
  }
}
