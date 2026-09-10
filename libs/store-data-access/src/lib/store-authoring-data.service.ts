import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface StoreCatalog {
  id: string;
  name: string;
  description?: string | null;
}

export interface StoreProduct {
  id: string;
  name: string;
  description?: string | null;
  priceCents: number;
  type: string;
  imageUrl?: string | null;
  stock?: number;
  active?: boolean;
  catalogId?: string | null;
}

export interface CreateStoreCatalogInput {
  name: string;
  description?: string;
}

export interface CreateStoreProductInput {
  name: string;
  description?: string;
  priceCents: number;
  type: string;
  imageUrl?: string;
  stock?: number;
  active?: boolean;
  catalogId?: string;
}

export interface StoreAuthoringWorkspace {
  workspaceId: string;
  workspaceSlug: string;
}

@Injectable({ providedIn: 'root' })
export class StoreAuthoringDataService {
  private readonly http = inject(HttpClient);

  listCatalogs(workspace: StoreAuthoringWorkspace): Observable<StoreCatalog[]> {
    return this.http.get<StoreCatalog[]>('/api/store/catalogs/mine', {
      params: this.workspaceParams(workspace),
      headers: this.workspaceHeaders(workspace),
    });
  }

  createCatalog(
    workspace: StoreAuthoringWorkspace,
    input: CreateStoreCatalogInput
  ): Observable<StoreCatalog> {
    return this.http.post<StoreCatalog>('/api/store/catalogs', input, {
      params: this.workspaceParams(workspace),
      headers: this.workspaceHeaders(workspace),
    });
  }

  listProducts(
    workspace: StoreAuthoringWorkspace,
    catalogId: string
  ): Observable<StoreProduct[]> {
    this.requireWorkspace(workspace);
    if (!catalogId.trim()) {
      throw new Error('A catalogId is required for Store authoring');
    }
    return this.http.get<StoreProduct[]>('/api/store/products', {
      params: this.workspaceParams(workspace).set('catalogId', catalogId),
      headers: this.workspaceHeaders(workspace),
    });
  }

  createProduct(
    workspace: StoreAuthoringWorkspace,
    input: CreateStoreProductInput
  ): Observable<StoreProduct> {
    return this.http.post<StoreProduct>('/api/store/products', input, {
      params: this.workspaceParams(workspace),
      headers: this.workspaceHeaders(workspace),
    });
  }

  private workspaceParams(workspace: StoreAuthoringWorkspace): HttpParams {
    return new HttpParams().set(
      'workspaceSlug',
      this.requireWorkspace(workspace)
    );
  }

  private workspaceHeaders(workspace: StoreAuthoringWorkspace) {
    this.requireWorkspace(workspace);
    return {
      'x-ot-appscope': 'business-site',
      'x-ot-workspace-id': workspace.workspaceId.trim(),
    };
  }

  private requireWorkspace(workspace: StoreAuthoringWorkspace): string {
    if (!workspace.workspaceId?.trim()) {
      throw new Error('A workspaceId is required for Store authoring');
    }
    if (!workspace.workspaceSlug?.trim()) {
      throw new Error('A workspaceSlug is required for Store authoring');
    }
    return workspace.workspaceSlug.trim();
  }
}
