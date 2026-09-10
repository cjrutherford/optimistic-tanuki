import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AppConfiguration,
  PublishedAppConfiguration,
} from '@optimistic-tanuki/app-config-models';
import { CONFIGURABLE_CLIENT_APP_SCOPE } from './auth-session.service';

@Injectable({
  providedIn: 'root',
})
export class ConfigurationService {
  private readonly API_URL = '/api/app-config';
  private configuration: PublishedAppConfiguration | null = null;

  constructor(private http: HttpClient) {}

  /**
   * Fetch configuration by domain
   */
  getConfigurationByDomain(
    domain: string
  ): Observable<PublishedAppConfiguration> {
    return this.http.get<PublishedAppConfiguration>(
      `${this.API_URL}/by-domain/${encodeURIComponent(domain)}`,
      { withCredentials: false }
    );
  }

  /**
   * Resolve a shared published-app link. The endpoint deliberately returns
   * the same not-found response for unpublished and unauthorized apps; cookie
   * credentials are included only to recognize an existing membership.
   */
  getPublishedConfiguration(id: string): Observable<PublishedAppConfiguration> {
    return this.http.get<PublishedAppConfiguration>(
      `${this.API_URL}/apps/${encodeURIComponent(id)}`,
      { withCredentials: true }
    );
  }

  /**
   * Fetch configuration by name
   */
  getConfigurationByName(
    name: string,
    workspaceSlug?: string
  ): Observable<AppConfiguration> {
    return this.http.get<AppConfiguration>(
      `${this.API_URL}/by-name/${encodeURIComponent(name)}`,
      this.protectedRequestOptions(workspaceSlug)
    );
  }

  /**
   * Fetch configuration by ID
   */
  getConfiguration(
    id: string,
    workspaceSlug?: string
  ): Observable<AppConfiguration> {
    return this.http.get<AppConfiguration>(
      `${this.API_URL}/${encodeURIComponent(id)}`,
      this.protectedRequestOptions(workspaceSlug)
    );
  }

  /**
   * Set current configuration
   */
  setConfiguration(config: PublishedAppConfiguration): void {
    this.configuration = config;
  }

  /** Cache an authenticated draft without leaking owner/release metadata to public consumers. */
  setProtectedConfiguration(config: AppConfiguration): void {
    const {
      ownerUserId: _ownerUserId,
      ownerProfileId: _ownerProfileId,
      appScope: _appScope,
      revision: _revision,
      release,
      ...publicFields
    } = config;
    this.configuration = {
      ...publicFields,
      publishedVersion: release?.publishedVersion ?? 0,
    };
  }

  /**
   * Get current configuration
   */
  getCurrentConfiguration(): PublishedAppConfiguration | null {
    return this.configuration;
  }

  private protectedRequestOptions(workspaceSlug?: string) {
    return {
      withCredentials: true,
      headers: { 'X-ot-appscope': CONFIGURABLE_CLIENT_APP_SCOPE },
      ...(workspaceSlug
        ? { params: new HttpParams().set('workspaceSlug', workspaceSlug) }
        : {}),
    };
  }
}
