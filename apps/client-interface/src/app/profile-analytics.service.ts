import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ProfileViewStats {
  totalViews: number;
  viewsToday: number;
  viewsThisWeek: number;
  viewsThisMonth: number;
  topSources: { source: string; count: number }[];
  recentViews: { viewerId: string; viewedAt: Date }[];
}

export interface ProfileViewer {
  viewerId: string;
  viewedAt: Date;
}

@Injectable({ providedIn: 'root' })
export class ProfileAnalyticsService {
  private baseUrl = '/api/profile-analytics';

  constructor(private http: HttpClient) {}

  recordView(
    profileId: string,
    viewerId: string,
    source: string
  ): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/view`, {
      profileId,
      viewerId,
      source,
    });
  }

  getViewStats(profileId: string): Observable<ProfileViewStats> {
    return this.http.get<ProfileViewStats>(
      `${this.baseUrl}/${profileId}/stats`
    );
  }

  getRecentViewers(
    profileId: string,
    limit: number = 10
  ): Observable<ProfileViewer[]> {
    return this.http.get<ProfileViewer[]>(
      `${this.baseUrl}/${profileId}/viewers?limit=${limit}`
    );
  }
}
