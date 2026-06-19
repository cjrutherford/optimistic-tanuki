import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { catchError, map, Observable, of, shareReplay, tap } from 'rxjs';

import { BusinessApiService, SiteConfigResponse } from './business-api.service';
import { BusinessAuthService } from './business-auth.service';
import {
  BusinessSiteConfig,
  cloneBusinessSiteConfig,
  DEFAULT_BUSINESS_SITE_CONFIG,
  mergeBusinessSiteConfig,
} from './business-site.config';

@Injectable({ providedIn: 'root' })
export class BusinessSiteConfigStore {
  private readonly api = inject(BusinessApiService);
  private readonly auth = inject(BusinessAuthService);

  private readonly _site = signal<BusinessSiteConfig>(
    cloneBusinessSiteConfig()
  );
  private readonly _configId = signal<string | null>(null);
  private readonly _loaded = signal(false);
  private readonly _siteSlug = signal<string | null>(null);
  private requestVersion = 0;
  private inFlight$: Observable<BusinessSiteConfig> | null = null;

  readonly site = this._site.asReadonly();
  readonly configId = this._configId.asReadonly();
  readonly loaded = computed(() => this._loaded());

  private readOwnerToken(): string | null {
    const tokenSignal = (
      this.auth as Partial<BusinessAuthService> & {
        token?: () => string | null;
      }
    ).token;
    return typeof tokenSignal === 'function' ? tokenSignal() : null;
  }

  private readClientToken(): string | null {
    const clientTokenSignal = (
      this.auth as Partial<BusinessAuthService> & {
        clientToken?: () => string | null;
      }
    ).clientToken;
    return typeof clientTokenSignal === 'function' ? clientTokenSignal() : null;
  }

  constructor() {
    this.fetch().subscribe();

    let previousOwnerToken = this.readOwnerToken();
    let previousClientToken = this.readClientToken();

    // Refresh owner/client scoped config when auth state changes.
    effect(() => {
      const ownerToken = this.readOwnerToken();
      const clientToken = this.readClientToken();
      const ownerChanged = ownerToken !== previousOwnerToken;
      const clientChanged = clientToken !== previousClientToken;

      previousOwnerToken = ownerToken;
      previousClientToken = clientToken;

      if (ownerChanged || clientChanged) {
        this._loaded.set(false);
        this.inFlight$ = null;
        this.fetch(true, this._siteSlug()).subscribe();
      }
    });
  }

  fetch(
    force = false,
    siteSlug?: string | null
  ): Observable<BusinessSiteConfig> {
    const slugChanged = (siteSlug ?? null) !== this._siteSlug();

    if (slugChanged) {
      this._loaded.set(false);
      this.inFlight$ = null;
      this._siteSlug.set(siteSlug ?? null);
    }

    if (this._loaded() && !force) {
      return of(this._site());
    }

    if (this.inFlight$ && !force) {
      return this.inFlight$;
    }

    const api = this.api as BusinessApiService & {
      getSiteConfigForSlug?: (
        siteSlug?: string | null
      ) => Observable<SiteConfigResponse>;
    };
    const activeSlug = siteSlug ?? this._siteSlug();
    const requestVersion = ++this.requestVersion;
    const siteConfigRequest: Observable<SiteConfigResponse> =
      typeof api.getSiteConfigForSlug === 'function'
        ? api.getSiteConfigForSlug(activeSlug)
        : this.api.getSiteConfig();

    this.inFlight$ = siteConfigRequest.pipe(
      map((response) => ({
        configId: response?.configId ?? null,
        site: mergeBusinessSiteConfig(
          response?.config ?? DEFAULT_BUSINESS_SITE_CONFIG
        ),
      })),
      catchError(() => {
        if (
          requestVersion !== this.requestVersion ||
          (activeSlug ?? null) !== this._siteSlug()
        ) {
          return of({
            configId: this._configId(),
            site: this._site(),
          });
        }

        return of({
          configId: null,
          site: cloneBusinessSiteConfig(),
        });
      }),
      tap((site) => {
        if (
          requestVersion !== this.requestVersion ||
          (activeSlug ?? null) !== this._siteSlug()
        ) {
          return;
        }

        this._configId.set(site.configId);
        this._site.set(site.site);
        this._loaded.set(true);
        this.inFlight$ = null;
      }),
      map((result) => result.site),
      shareReplay(1)
    );

    return this.inFlight$ as Observable<BusinessSiteConfig>;
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
