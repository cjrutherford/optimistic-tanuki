import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

export interface DiscoveredWorkspace {
  workspaceId: string;
  kind: 'business-site' | 'community';
  slug: string;
  displayName: string;
  appScope: string;
  status: 'draft' | 'active' | 'suspended' | 'archived';
  appInstanceId?: string;
  configurationId?: string;
  membershipRole?: 'owner' | 'admin' | 'moderator' | 'member';
  membershipStatus?: 'invited' | 'active' | 'suspended' | 'removed';
}

@Injectable({ providedIn: 'root' })
export class WorkspaceDiscoveryApiService {
  private readonly apiUrl = '/api/workspaces';

  constructor(private readonly http: HttpClient) {}

  list(): Observable<DiscoveredWorkspace[]> {
    return this.http.get<DiscoveredWorkspace[]>(this.apiUrl);
  }

  get(workspaceId: string): Observable<DiscoveredWorkspace> {
    return this.http.get<DiscoveredWorkspace>(
      `${this.apiUrl}/${encodeURIComponent(workspaceId)}`
    );
  }

  provisionBusinessSite(): Observable<unknown> {
    return this.http.post(
      '/api/workspaces/business-sites/provision',
      {},
      {
        headers: { 'X-ot-appscope': 'business-site' },
      }
    );
  }
}
