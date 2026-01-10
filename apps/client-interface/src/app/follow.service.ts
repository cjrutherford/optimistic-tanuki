import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL, FollowDto } from '@optimistic-tanuki/ui-models';

@Injectable({
  providedIn: 'root'
})
export class FollowService {
  private baseUrl: string;

  constructor(
    @Inject(API_BASE_URL) private apiBaseUrl: string,
    private http: HttpClient
  ) {
    this.baseUrl = `${this.apiBaseUrl}/social/follow`;
  }

  follow(dto: FollowDto): Observable<any> {
    return this.http.post(this.baseUrl, dto);
  }

  unfollow(dto: FollowDto): Observable<any> {
    return this.http.post(`${this.baseUrl}/unfollow`, dto);
  }

  getFollowers(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/${id}`);
  }

  getFollowing(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/following/${id}`);
  }
}
