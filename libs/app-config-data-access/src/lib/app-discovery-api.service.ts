import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  AppAccessPolicy,
  PublishedAppConfiguration,
} from '@optimistic-tanuki/app-config-models';

export interface DiscoveredApp {
  appId: string;
  name: string;
  description?: string;
  domain?: string;
  accessPolicy: AppAccessPolicy;
  publishedVersion: number;
  membershipRole: string | null;
  membershipStatus: string | null;
  canOpen: boolean;
  canJoin: boolean;
  canRequest: boolean;
}

export interface AppMembershipResult {
  appId: string;
  role: string;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class AppDiscoveryApiService {
  private readonly apiUrl = '/api/app-config';

  constructor(private readonly http: HttpClient) {}

  list(
    search?: string,
    accessPolicy?: AppAccessPolicy
  ): Observable<DiscoveredApp[]> {
    let params = new HttpParams();
    if (search?.trim()) params = params.set('search', search.trim());
    if (accessPolicy) params = params.set('accessPolicy', accessPolicy);
    return this.http.get<DiscoveredApp[]>(`${this.apiUrl}/discover`, {
      params,
      withCredentials: true,
    });
  }

  open(appId: string): Observable<PublishedAppConfiguration> {
    return this.http.get<PublishedAppConfiguration>(
      `${this.apiUrl}/apps/${encodeURIComponent(appId)}`,
      { withCredentials: true }
    );
  }

  join(appId: string): Observable<AppMembershipResult> {
    return this.http.post<AppMembershipResult>(
      `${this.apiUrl}/apps/${encodeURIComponent(appId)}/join`,
      {},
      { withCredentials: true }
    );
  }

  request(appId: string): Observable<AppMembershipResult> {
    return this.http.post<AppMembershipResult>(
      `${this.apiUrl}/apps/${encodeURIComponent(appId)}/request`,
      {},
      { withCredentials: true }
    );
  }
}
