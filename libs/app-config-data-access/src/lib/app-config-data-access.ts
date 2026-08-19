import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import type {
  AppConfiguration,
  PublishedAppConfiguration,
  PublishAppConfigDto,
  RollbackAppConfigDto,
  UpdateAppConfigDto,
} from '@optimistic-tanuki/app-config-models';
import type { Observable } from 'rxjs';

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
  getByDomain(domain: string): Observable<AppConfiguration> {
    return this.getPublishedByDomain(domain);
  }

  get(id: string): Observable<AppConfiguration> {
    return this.http.get<AppConfiguration>(
      `${this.apiUrl}/${encodeURIComponent(id)}`
    );
  }

  update(id: string, patch: UpdateAppConfigDto): Observable<AppConfiguration> {
    return this.http.put<AppConfiguration>(
      `${this.apiUrl}/${encodeURIComponent(id)}`,
      patch
    );
  }

  publish(
    id: string,
    payload: PublishAppConfigDto
  ): Observable<AppConfiguration> {
    return this.http.post<AppConfiguration>(
      `${this.apiUrl}/${encodeURIComponent(id)}/publish`,
      payload
    );
  }

  rollback(
    id: string,
    payload: RollbackAppConfigDto
  ): Observable<AppConfiguration> {
    return this.http.post<AppConfiguration>(
      `${this.apiUrl}/${encodeURIComponent(id)}/rollback`,
      payload
    );
  }
}
