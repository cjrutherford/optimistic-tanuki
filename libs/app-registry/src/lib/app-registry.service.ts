import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, InjectionToken, OnDestroy, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  AppRegistration,
  AppRegistry,
  AppRegistryResponse,
  DEFAULT_APP_REGISTRY,
} from '@optimistic-tanuki/app-registry-backend';
import {
  BehaviorSubject,
  Observable,
  catchError,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
} from 'rxjs';

export const APP_REGISTRY_URL = new InjectionToken<string>('APP_REGISTRY_URL', {
  providedIn: 'root',
  factory: () => '/api/registry/apps',
});

export const APP_REGISTRY_REFRESH_INTERVAL_MS = new InjectionToken<number>(
  'APP_REGISTRY_REFRESH_INTERVAL_MS',
  {
    providedIn: 'root',
    factory: () => 300000,
  }
);

@Injectable({ providedIn: 'root' })
export class AppRegistryService implements OnDestroy {
  private readonly refreshTrigger$ = new BehaviorSubject<void>(undefined);
  private readonly registry$: Observable<AppRegistry>;
  private latestRegistry = DEFAULT_APP_REGISTRY;
  private refreshTimer?: ReturnType<typeof setInterval>;

  readonly registryVersion = DEFAULT_APP_REGISTRY.version;

  constructor(
    private readonly http: HttpClient,
    @Inject(APP_REGISTRY_URL) private readonly registryUrl = '/api/registry/apps',
    @Inject(APP_REGISTRY_REFRESH_INTERVAL_MS)
    private readonly refreshIntervalMs = 300000,
    @Inject(PLATFORM_ID) private readonly platformId: object
  ) {
    this.registry$ = this.refreshTrigger$.pipe(
      switchMap(() => this.fetchFromGateway()),
      tap((registry) => {
        this.latestRegistry = registry;
      }),
      shareReplay(1)
    );
    if (isPlatformBrowser(this.platformId)) {
      this.registry$.subscribe();
      this.startPolling();
    }
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  }

  getAllApps(): Observable<AppRegistration[]> {
    return this.registry$.pipe(map((registry) => registry.apps));
  }

  getApp(appId: string): Observable<AppRegistration | null> {
    return this.getAllApps().pipe(
      map((apps) => apps.find((app) => app.appId === appId) ?? null)
    );
  }

  getAppByDomain(domain: string): Observable<AppRegistration | null> {
    return this.getAllApps().pipe(
      map(
        (apps) =>
          apps.find((app) => app.domain === domain || app.uiBaseUrl.includes(domain)) ??
          null
      )
    );
  }

  getPublicApps(): Observable<AppRegistration[]> {
    return this.getAllApps().pipe(
      map((apps) => apps.filter((app) => app.visibility === 'public'))
    );
  }

  getInternalApps(): Observable<AppRegistration[]> {
    return this.getAllApps().pipe(
      map((apps) => apps.filter((app) => app.visibility === 'internal'))
    );
  }

  refresh(): Observable<AppRegistry> {
    this.refreshTrigger$.next();
    return this.registry$;
  }

  getAppUrl(
    appId: string,
    path?: string,
    queryParams?: Record<string, string>
  ): string {
    const app = this.latestRegistry.apps.find((entry) => entry.appId === appId);
    if (!app) {
      return '/';
    }

    let url = app.uiBaseUrl;
    if (path) {
      url += path.startsWith('/') ? path : `/${path}`;
    }

    if (queryParams && Object.keys(queryParams).length > 0) {
      url += `?${new URLSearchParams(queryParams).toString()}`;
    }

    return url;
  }

  isAppAccessible(appId: string): boolean {
    return this.latestRegistry.apps.some((app) => app.appId === appId);
  }

  getAppSync(appId: string): AppRegistration | null {
    return this.latestRegistry.apps.find((app) => app.appId === appId) ?? null;
  }

  private fetchFromGateway(): Observable<AppRegistry> {
    return this.http.get<AppRegistryResponse>(this.registryUrl).pipe(
      map((response) => (response.success ? response.data : DEFAULT_APP_REGISTRY)),
      catchError(() => of(DEFAULT_APP_REGISTRY))
    );
  }

  private startPolling(): void {
    if (this.refreshIntervalMs <= 0) {
      return;
    }

    this.refreshTimer = setInterval(() => {
      this.refreshTrigger$.next();
    }, this.refreshIntervalMs);
  }
}

export const APP_REGISTRY = new InjectionToken<AppRegistryService>('APP_REGISTRY');
