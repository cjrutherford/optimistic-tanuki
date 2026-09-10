import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import type {
  AppConfiguration,
  PublishedAppConfiguration,
  PublishAppConfigDto,
  RollbackAppConfigDto,
  UpdateAppConfigDto,
} from '@optimistic-tanuki/app-config-models';
import { map, type Observable } from 'rxjs';
import {
  isScopedAppConfiguration,
  type ScopedAppConfiguration,
} from './scoped-app-configuration.contract';

const CONFIGURABLE_CLIENT_APP_SCOPE = 'configurable-client';

@Injectable({ providedIn: 'root' })
export class AppConfigApiService {
  private readonly apiUrl = '/api/app-config';

  constructor(private readonly http: HttpClient) {}

  getPublishedByDomain(domain: string): Observable<PublishedAppConfiguration> {
    return this.http.get<PublishedAppConfiguration>(
      `${this.apiUrl}/by-domain/${encodeURIComponent(domain)}`
    );
  }

  /** @deprecated Public callers should use getPublishedByDomain. */
  /** Public lookup of the published configuration; never carries owner workspace scope. */
  getByDomain(domain: string): Observable<AppConfiguration> {
    return this.getPublishedByDomain(domain);
  }

  get(id: string, workspaceSlug: string): Observable<ScopedAppConfiguration> {
    return this.http
      .get<unknown>(
        this.scopedUrl(id, workspaceSlug),
        this.protectedRequestOptions()
      )
      .pipe(map((configuration) => this.requireScoped(configuration)));
  }

  update(
    id: string,
    patch: UpdateAppConfigDto,
    workspaceSlug: string
  ): Observable<AppConfiguration> {
    return this.http.put<AppConfiguration>(
      this.scopedUrl(id, workspaceSlug),
      patch,
      this.protectedRequestOptions()
    );
  }

  publish(
    id: string,
    payload: PublishAppConfigDto,
    workspaceSlug: string
  ): Observable<ScopedAppConfiguration> {
    return this.http
      .post<unknown>(
        `${this.apiUrl}/${encodeURIComponent(id)}/publish${this.query(
          workspaceSlug
        )}`,
        payload,
        this.protectedRequestOptions()
      )
      .pipe(map((configuration) => this.requireScoped(configuration)));
  }

  rollback(
    id: string,
    payload: RollbackAppConfigDto,
    workspaceSlug: string
  ): Observable<ScopedAppConfiguration> {
    return this.http
      .post<unknown>(
        `${this.apiUrl}/${encodeURIComponent(id)}/rollback${this.query(
          workspaceSlug
        )}`,
        payload,
        this.protectedRequestOptions()
      )
      .pipe(map((configuration) => this.requireScoped(configuration)));
  }

  private protectedRequestOptions() {
    return {
      withCredentials: true,
      headers: { 'X-ot-appscope': CONFIGURABLE_CLIENT_APP_SCOPE },
    };
  }

  private scopedUrl(id: string, workspaceSlug: string): string {
    return `${this.apiUrl}/${encodeURIComponent(id)}${this.query(
      workspaceSlug
    )}`;
  }

  private query(workspaceSlug: string): string {
    return `?workspaceSlug=${encodeURIComponent(workspaceSlug)}`;
  }

  private requireScoped(value: unknown): ScopedAppConfiguration {
    if (!isScopedAppConfiguration(value)) {
      throw new Error(
        'The app configuration response is missing workspace scope.'
      );
    }
    return value;
  }
}
