import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, of } from 'rxjs';
import { AppConfiguration } from '@optimistic-tanuki/app-config-models';
import { resolveHaiAppLinks } from './hai-app.directory';

@Injectable({ providedIn: 'root' })
export class HaiAppDirectoryService {
  private readonly http = inject(HttpClient);

  getResolvedApps(currentAppId?: string) {
    return this.http.get<AppConfiguration[]>('/api/app-config').pipe(
      map((configs) => resolveHaiAppLinks(configs, currentAppId)),
      catchError(() => of(resolveHaiAppLinks([], currentAppId)))
    );
  }
}
