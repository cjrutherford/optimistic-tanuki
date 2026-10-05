import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, of } from 'rxjs';
import { AppRegistryResponse } from '@optimistic-tanuki/app-registry-backend';
import { resolveHaiAppLinks } from './hai-app.directory';

@Injectable({ providedIn: 'root' })
export class HaiAppDirectoryService {
  private readonly http = inject(HttpClient);

  getResolvedApps(currentAppId?: string) {
    return this.http.get<AppRegistryResponse>('/api/registry/apps').pipe(
      map((response) =>
        resolveHaiAppLinks(
          response.success ? response.data.apps : [],
          currentAppId
        )
      ),
      catchError(() => of(resolveHaiAppLinks([], currentAppId)))
    );
  }
}
