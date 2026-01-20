import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfiguration } from '@optimistic-tanuki/app-config-models';

@Injectable({
  providedIn: 'root',
})
export class ConfigurationService {
  private readonly API_URL = '/api/app-config';
  private configuration: AppConfiguration | null = null;

  constructor(private http: HttpClient) {}

  /**
   * Fetch configuration by domain
   */
  getConfigurationByDomain(domain: string): Observable<AppConfiguration> {
    return this.http.get<AppConfiguration>(
      `${this.API_URL}/by-domain/${domain}`
    );
  }

  /**
   * Fetch configuration by name
   */
  getConfigurationByName(name: string): Observable<AppConfiguration> {
    return this.http.get<AppConfiguration>(`${this.API_URL}/by-name/${name}`);
  }

  /**
   * Fetch configuration by ID
   */
  getConfiguration(id: string): Observable<AppConfiguration> {
    return this.http.get<AppConfiguration>(`${this.API_URL}/${id}`);
  }

  /**
   * Set current configuration
   */
  setConfiguration(config: AppConfiguration): void {
    this.configuration = config;
  }

  /**
   * Get current configuration
   */
  getCurrentConfiguration(): AppConfiguration | null {
    return this.configuration;
  }
}
