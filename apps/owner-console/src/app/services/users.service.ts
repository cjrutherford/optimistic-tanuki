import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProfileDto } from '@optimistic-tanuki/ui-models';

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private readonly API_URL = 'http://localhost:3000/profile';

  constructor(private http: HttpClient) {}

  getProfiles(): Observable<ProfileDto[]> {
    return this.http.get<ProfileDto[]>(`${this.API_URL}`);
  }

  getProfile(id: string): Observable<ProfileDto> {
    return this.http.get<ProfileDto>(`${this.API_URL}/${id}`);
  }

  updateProfile(id: string, profile: Partial<ProfileDto>): Observable<ProfileDto> {
    return this.http.put<ProfileDto>(`${this.API_URL}/${id}`, profile);
  }
}
