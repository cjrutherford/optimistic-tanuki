import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface BlogCatalog {
  id: string;
  name: string;
  description?: string | null;
  ownerId: string;
  workspaceId: string;
  appScope: string;
}

@Injectable({ providedIn: 'root' })
export class BlogCatalogService {
  constructor(private readonly http: HttpClient) {}

  getMyCatalogs(workspaceSlug: string): Observable<BlogCatalog[]> {
    return this.http.get<BlogCatalog[]>('/api/blog/catalogs/mine', {
      params: new HttpParams().set('workspaceSlug', workspaceSlug),
    });
  }
}
