import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { OptomisitcTanukiAPIService } from '@optimistic-tanuki/blogging-data-access';

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
  private readonly blogging = inject(OptomisitcTanukiAPIService);

  getMyCatalogs(workspaceSlug: string): Observable<BlogCatalog[]> {
    return this.blogging.blogControllerFindMyCatalogs<BlogCatalog[]>({
      params: { workspaceSlug },
    });
  }
}
