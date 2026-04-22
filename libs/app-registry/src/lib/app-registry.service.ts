import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, InjectionToken } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  catchError,
  map,
  of,
  shareReplay,
  switchMap,
} from 'rxjs';
import {
  AppRegistration,
  AppRegistry,
  AppRegistryResponse,
} from './app-registry.types';
import { DEFAULT_APP_REGISTRY } from './default-registry';

export const APP_REGISTRY_URL = new InjectionToken<string>('APP_REGISTRY_URL', {
  providedIn: 'root',
  factory: () => '/api/registry/apps',
});

@Injectable({ providedIn: 'root' })
export class AppRegistryService {
  private readonly refreshTrigger$ = new BehaviorSubject<void>(undefined);
  private readonly registry$: Observable<AppRegistry>;

  readonly registryVersion = DEFAULT_APP_REGISTRY.version;

  constructor(
    private readonly http: HttpClient,
    @Inject(APP_REGISTRY_URL) private readonly registryUrl = '/api/registry/apps'
  ) {
    this.registry$ = this.refreshTrigger$.pipe(
      switchMap(() => this.fetchFromGateway()),
      shareReplay(1)
    );
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
    const app = DEFAULT_APP_REGISTRY.apps.find((entry) => entry.appId === appId);
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
    return DEFAULT_APP_REGISTRY.apps.some((app) => app.appId === appId);
  }

  private fetchFromGateway(): Observable<AppRegistry> {
    return this.http.get<AppRegistryResponse>(this.registryUrl).pipe(
      map((response) => (response.success ? response.data : DEFAULT_APP_REGISTRY)),
      catchError(() => of(DEFAULT_APP_REGISTRY))
    );
  }
}

export const APP_REGISTRY = new InjectionToken<AppRegistryService>('APP_REGISTRY');
