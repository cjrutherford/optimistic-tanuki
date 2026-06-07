import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, of } from 'rxjs';
import {
  AppRegistryResponse,
  DEFAULT_APP_REGISTRY,
} from '@optimistic-tanuki/app-registry-backend';
import { resolveHaiAppLinks } from './hai-app.directory';

@Injectable({ providedIn: 'root' })
export class HaiAppDirectoryService {
  private readonly http = inject(HttpClient);

  getResolvedApps(currentAppId?: string) {
    return this.http.get<AppRegistryResponse>('/api/registry/apps').pipe(
      map((response) =>
        resolveHaiAppLinks(
          response.success ? response.data.apps : DEFAULT_APP_REGISTRY.apps,
          currentAppId
        )
      ),
      catchError(() =>
        of(resolveHaiAppLinks(DEFAULT_APP_REGISTRY.apps, currentAppId))
      )
    );
  }
}
