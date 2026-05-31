import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, map, Observable, of, shareReplay, tap } from 'rxjs';

import { BusinessApiService } from './business-api.service';
import {
  BusinessSiteConfig,
  cloneBusinessSiteConfig,
  DEFAULT_BUSINESS_SITE_CONFIG,
  mergeBusinessSiteConfig,
} from './business-site.config';

@Injectable({ providedIn: 'root' })
export class BusinessSiteConfigStore {
  private readonly api = inject(BusinessApiService);

  private readonly _site = signal<BusinessSiteConfig>(
    cloneBusinessSiteConfig()
  );
  private readonly _configId = signal<string | null>(null);
  private readonly _loaded = signal(false);
  private inFlight$: Observable<BusinessSiteConfig> | null = null;

  readonly site = this._site.asReadonly();
  readonly configId = this._configId.asReadonly();
  readonly loaded = computed(() => this._loaded());

  constructor() {
    this.fetch().subscribe();
  }

  fetch(force = false): Observable<BusinessSiteConfig> {
    if (this._loaded() && !force) {
      return of(this._site());
    }

    if (this.inFlight$ && !force) {
      return this.inFlight$;
    }

    this.inFlight$ = this.api.getSiteConfig().pipe(
      map((response) => {
        this._configId.set(response?.configId ?? null);
        return mergeBusinessSiteConfig(
          response?.config ?? DEFAULT_BUSINESS_SITE_CONFIG
        );
      }),
      catchError(() => {
        this._configId.set(null);
        return of(cloneBusinessSiteConfig());
      }),
      tap((site) => {
        this._site.set(site);
        this._loaded.set(true);
        this.inFlight$ = null;
      }),
      shareReplay(1)
    );

    return this.inFlight$;
  }

  setSite(
    config: Partial<BusinessSiteConfig> | BusinessSiteConfig,
    configId = this._configId()
  ): void {
    this._site.set(mergeBusinessSiteConfig(config));
    this._configId.set(configId ?? null);
    this._loaded.set(true);
  }
}
