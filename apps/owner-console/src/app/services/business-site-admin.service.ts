import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { SiteConfigResponse } from '@optimistic-tanuki/business-data-access';

@Injectable({
  providedIn: 'root',
})
export class BusinessSiteAdminService {
  constructor(private readonly http: HttpClient) {}

  getSiteConfig(): Observable<SiteConfigResponse> {
    return this.http.get<SiteConfigResponse>('/api/business/site-config');
  }

  updateCatalogSource(
    configId: string | null,
    source: 'manual' | 'store'
  ): Observable<unknown> {
    return this.http.put('/api/business/site-config/catalog-source', {
      configId,
      source,
    });
  }
}
