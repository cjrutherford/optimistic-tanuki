import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  AppRegistry,
  AppRegistryResponse,
  PublishRegistryDto,
  RegistryReleaseBundleResponse,
  RollbackRegistryDto,
  NavigationLink,
  RegistryAuditRecord,
  RegistryDriftReport,
  RegistryYamlExport,
} from '@optimistic-tanuki/app-registry-backend';
import { Observable } from 'rxjs';

export interface NavigationLinksResponse {
  success: boolean;
  data: NavigationLink[];
}

/** A stored audit row: who did what, and the reason they gave. */
export type RegistryAuditEntry = RegistryAuditRecord;

export interface RegistryDriftResponse {
  success: boolean;
  data: RegistryDriftReport;
}

export interface RegistryExportResponse {
  success: boolean;
  data: RegistryYamlExport;
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

  updateRegistry(
    registry: AppRegistry,
    reason?: string
  ): Observable<AppRegistryResponse> {
    return this.http.post<AppRegistryResponse>(`${this.apiUrl}/apps`, {
      registry,
      reason,
    });
  }

  publishRegistry(
    dto: PublishRegistryDto
  ): Observable<RegistryReleaseBundleResponse> {
    return this.http.post<RegistryReleaseBundleResponse>(
      `${this.apiUrl}/publish`,
      dto
    );
  }

  rollbackRegistry(
    dto: RollbackRegistryDto
  ): Observable<RegistryReleaseBundleResponse> {
    return this.http.post<RegistryReleaseBundleResponse>(
      `${this.apiUrl}/rollback`,
      dto
    );
  }

  getLinks(): Observable<NavigationLinksResponse> {
    return this.http.get<NavigationLinksResponse>(`${this.apiUrl}/links`);
  }

  updateLinks(
    links: NavigationLink[],
    reason?: string
  ): Observable<NavigationLinksResponse> {
    return this.http.post<NavigationLinksResponse>(`${this.apiUrl}/links`, {
      links,
      reason,
    });
  }

  getAuditLog(): Observable<RegistryAuditResponse> {
    return this.http.get<RegistryAuditResponse>(`${this.apiUrl}/audit-log`);
  }

  getDrift(): Observable<RegistryDriftResponse> {
    return this.http.get<RegistryDriftResponse>(`${this.apiUrl}/drift`);
  }

  exportYaml(): Observable<RegistryExportResponse> {
    return this.http.get<RegistryExportResponse>(`${this.apiUrl}/export`);
  }
}
