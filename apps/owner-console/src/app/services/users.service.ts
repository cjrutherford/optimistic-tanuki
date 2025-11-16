import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Profile {
  id: string;
  userId: string;
  name: string;
  coverPic?: string;
  profilePic?: string;
  bio?: string;
  location?: string;
  description?: string;
  occupation?: string;
  interests?: string;
  skills?: string;
  created_at?: Date;
  updated_at?: Date;
}

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private readonly API_URL = 'http://localhost:3000/profile';

  constructor(private http: HttpClient) {}

  getProfiles(): Observable<Profile[]> {
    return this.http.get<Profile[]>(`${this.API_URL}`);
  }

  getProfile(id: string): Observable<Profile> {
    return this.http.get<Profile>(`${this.API_URL}/${id}`);
  }

  updateProfile(id: string, profile: Partial<Profile>): Observable<Profile> {
    return this.http.put<Profile>(`${this.API_URL}/${id}`, profile);
  }
}
