import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AppConfiguration,
  CreateAppConfigDto,
  UpdateAppConfigDto,
} from '@optimistic-tanuki/app-config-models';

@Injectable({
  providedIn: 'root',
})
export class AppConfigService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/app-config';

  /**
   * Create a new app configuration
   */
  createAppConfig(dto: CreateAppConfigDto): Observable<AppConfiguration> {
    return this.http.post<AppConfiguration>(this.baseUrl, dto);
  }

  /**
   * Get all app configurations
   */
  getAllAppConfigs(): Observable<AppConfiguration[]> {
    return this.http.get<AppConfiguration[]>(this.baseUrl);
  }

  /**
   * Get app configuration by ID
   */
  getAppConfigById(id: string): Observable<AppConfiguration> {
    return this.http.get<AppConfiguration>(`${this.baseUrl}/${id}`);
  }

  /**
   * Get app configuration by name
   */
  getAppConfigByName(name: string): Observable<AppConfiguration> {
    return this.http.get<AppConfiguration>(`${this.baseUrl}/by-name/${name}`);
  }

  /**
   * Get app configuration by domain
   */
  getAppConfigByDomain(domain: string): Observable<AppConfiguration> {
    return this.http.get<AppConfiguration>(`${this.baseUrl}/by-domain/${domain}`);
  }

  /**
   * Update an existing app configuration
   */
  updateAppConfig(id: string, dto: UpdateAppConfigDto): Observable<AppConfiguration> {
    return this.http.put<AppConfiguration>(`${this.baseUrl}/${id}`, dto);
  }

  /**
   * Delete an app configuration
   */
  deleteAppConfig(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /**
   * Get app configs created by the current user
   */
  getMyAppConfigs(): Observable<AppConfiguration[]> {
    // This will filter on the backend based on the authenticated user
    // For now, we get all and filter client-side
    return this.getAllAppConfigs();
  }
}
