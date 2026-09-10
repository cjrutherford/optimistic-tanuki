import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { SiteConfigResponse } from '@optimistic-tanuki/business-data-access';

@Injectable({
  providedIn: 'root',
})
export class BusinessSiteAdminService {
  constructor(private readonly http: HttpClient) {}

  getSiteConfig(workspaceSlug?: string | null): Observable<SiteConfigResponse> {
    return this.http.get<SiteConfigResponse>('/api/business/site-config', {
      params: workspaceSlug
        ? new HttpParams().set('slug', workspaceSlug)
        : undefined,
    });
  }

  updateCommerceSettings(
    configId: string | null,
    payload: {
      source: 'manual' | 'store';
      storeEnabled: boolean;
      catalogId?: string | null;
    },
    workspaceSlug?: string | null
  ): Observable<unknown> {
    return this.http.put(
      '/api/business/site-config/catalog-source',
      { configId, ...payload },
      {
        params: workspaceSlug
          ? new HttpParams().set('slug', workspaceSlug)
          : undefined,
      }
    );
  }
}
