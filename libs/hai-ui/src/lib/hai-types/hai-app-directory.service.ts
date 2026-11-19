import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, of } from 'rxjs';
import {
  AppRegistration,
  AppRegistryResponse,
} from '@optimistic-tanuki/app-registry-backend';
import { resolveHaiAppLinks, resolvePublicAppUrl } from './hai-app.directory';

@Injectable({ providedIn: 'root' })
export class HaiAppDirectoryService {
  private readonly http = inject(HttpClient);

  getResolvedApps(currentAppId?: string) {
    return this.getRegistryApps().pipe(
      map((apps) => resolveHaiAppLinks(apps, currentAppId))
    );
  }

  /**
   * The URL the registry publishes for one app in this environment: the dev
   * registry gives the dev URL and the production registry the production
   * URL. Emits undefined when the registry is unreachable or does not publish
   * the app publicly, so callers can hide the link rather than guess.
   */
  getPublicAppUrl(appId: string) {
    return this.getRegistryApps().pipe(
      map((apps) => resolvePublicAppUrl(apps, appId))
    );
  }

  private getRegistryApps() {
    return this.http.get<AppRegistryResponse>('/api/registry/apps').pipe(
      map((response): AppRegistration[] =>
        response.success ? response.data.apps : []
      ),
      catchError(() => of([] as AppRegistration[]))
    );
  }
}
