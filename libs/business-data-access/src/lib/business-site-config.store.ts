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

function describeSiteConfigError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error) {
    return error;
  }

  return 'Failed to load business site configuration.';
}

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
  /**
   * Set whenever the most recent (non-stale) fetch attempt failed and the
   * store fell back to the default config. `null` means the last completed
   * fetch (or manual `setSite`) succeeded. Distinguishing this from a
   * genuinely-disabled feature is the whole point of this signal — see
   * `fetch()` for how staleness is handled.
   */
  private readonly _loadError = signal<string | null>(null);
  private requestVersion = 0;
  private inFlight$: Observable<BusinessSiteConfig> | null = null;
  private inFlightAuthScope: string | null | undefined;
  private loadedAuthScope: string | null | undefined;

  readonly site = this._site.asReadonly();
  readonly configId = this._configId.asReadonly();
  readonly loaded = computed(() => this._loaded());
  readonly loadError = this._loadError.asReadonly();

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

  private readAuthScope(): string | null {
    const auth = this.auth as Partial<BusinessAuthService> & {
      user?: () => {
        profileId?: string;
        userId?: string;
        email?: string;
      } | null;
      clientUser?: () => {
        profileId?: string;
        userId?: string;
        email?: string;
      } | null;
    };
    const owner = typeof auth.user === 'function' ? auth.user() : null;
    if (owner) {
      return `owner:${
        owner.profileId || owner.userId || owner.email || 'authenticated'
      }`;
    }
    const client =
      typeof auth.clientUser === 'function' ? auth.clientUser() : null;
    if (client) {
      return `client:${
        client.profileId || client.userId || client.email || 'authenticated'
      }`;
    }
    const ownerToken = this.readOwnerToken();
    if (ownerToken) return `owner-token:${ownerToken}`;
    const clientToken = this.readClientToken();
    return clientToken ? `client-token:${clientToken}` : null;
  }

  constructor() {
    this.fetch().subscribe();

    let previousAuthScope = this.readAuthScope();

    // Refresh owner/client scoped config when auth state changes.
    effect(() => {
      const authScope = this.readAuthScope();
      const authChanged = authScope !== previousAuthScope;

      previousAuthScope = authScope;

      if (authChanged) {
        this._loaded.set(false);
        this._loadError.set(null);
        this.inFlight$ = null;
        this.inFlightAuthScope = undefined;
        this.fetch(true, this._siteSlug()).subscribe();
      }
    });
  }

  fetch(
    force = false,
    siteSlug?: string | null
  ): Observable<BusinessSiteConfig> {
    const authScope = this.readAuthScope();
    const slugChanged = (siteSlug ?? null) !== this._siteSlug();
    const authScopeChanged =
      (this.loadedAuthScope !== undefined &&
        this.loadedAuthScope !== authScope) ||
      (this.inFlight$ !== null && this.inFlightAuthScope !== authScope);

    if (slugChanged || authScopeChanged) {
      this._loaded.set(false);
      this._loadError.set(null);
      this.inFlight$ = null;
      this.inFlightAuthScope = undefined;
    }
    if (slugChanged) {
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
    const requestAuthScope = authScope;
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
        error: null as string | null,
      })),
      catchError((error: unknown) => {
        if (
          requestVersion !== this.requestVersion ||
          (activeSlug ?? null) !== this._siteSlug()
        ) {
          return of({
            configId: this._configId(),
            site: this._site(),
            error: null as string | null,
          });
        }

        return of({
          configId: null,
          site: cloneBusinessSiteConfig(),
          error: describeSiteConfigError(error),
        });
      }),
      tap((result) => {
        if (
          requestVersion !== this.requestVersion ||
          (activeSlug ?? null) !== this._siteSlug()
        ) {
          return;
        }

        this._configId.set(result.configId);
        this._site.set(result.site);
        this._loaded.set(true);
        this._loadError.set(result.error);
        this.loadedAuthScope = requestAuthScope;
        this.inFlight$ = null;
        this.inFlightAuthScope = undefined;
      }),
      map((result) => result.site),
      shareReplay(1)
    );

    this.inFlightAuthScope = requestAuthScope;
    return this.inFlight$ as Observable<BusinessSiteConfig>;
  }

  setSite(
    config: Partial<BusinessSiteConfig> | BusinessSiteConfig,
    configId = this._configId()
  ): void {
    this._site.set(mergeBusinessSiteConfig(config));
    this._configId.set(configId ?? null);
    this._loaded.set(true);
    this._loadError.set(null);
    this.loadedAuthScope = this.readAuthScope();
  }
}
