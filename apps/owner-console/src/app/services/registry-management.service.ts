import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  AppRegistry,
  AppRegistryResponse,
  NavigationLink,
} from '@optimistic-tanuki/app-registry-backend';
import { Observable } from 'rxjs';

export interface NavigationLinksResponse {
  success: boolean;
  data: NavigationLink[];
}

export interface RegistryAuditEntry {
  id: number;
  occurredAt: string;
  action: 'apps.updated' | 'links.updated';
  summary: string;
  metadata: Record<string, string | number | boolean>;
}

export interface RegistryAuditResponse {
  success: boolean;
  data: RegistryAuditEntry[];
}

@Injectable({
  providedIn: 'root',
})
export class RegistryManagementService {
  private readonly apiUrl = '/api/registry';

  constructor(private readonly http: HttpClient) {}

  getRegistry(): Observable<AppRegistryResponse> {
    return this.http.get<AppRegistryResponse>(`${this.apiUrl}/apps`);
  }

  updateRegistry(registry: AppRegistry): Observable<AppRegistryResponse> {
    return this.http.post<AppRegistryResponse>(`${this.apiUrl}/apps`, {
      registry,
    });
  }

  getLinks(): Observable<NavigationLinksResponse> {
    return this.http.get<NavigationLinksResponse>(`${this.apiUrl}/links`);
  }

  updateLinks(links: NavigationLink[]): Observable<NavigationLinksResponse> {
    return this.http.post<NavigationLinksResponse>(`${this.apiUrl}/links`, {
      links,
    });
  }

  getAuditLog(): Observable<RegistryAuditResponse> {
    return this.http.get<RegistryAuditResponse>(`${this.apiUrl}/audit-log`);
  }
}
