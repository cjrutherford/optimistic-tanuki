import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { OptomisitcTanukiAPIService } from '../generated/store';

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
  private readonly store = inject(OptomisitcTanukiAPIService);

  listCatalogs(workspace: StoreAuthoringWorkspace): Observable<StoreCatalog[]> {
    return this.store.storeControllerFindMyCatalogs<StoreCatalog[]>({
      params: this.workspaceParams(workspace),
      headers: this.workspaceHeaders(workspace),
    });
  }

  createCatalog(
    workspace: StoreAuthoringWorkspace,
    input: CreateStoreCatalogInput
  ): Observable<StoreCatalog> {
    return this.store.storeControllerCreateCatalog<StoreCatalog>(input, {
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
    return this.store.storeControllerFindAllProducts<StoreProduct[]>(
      { catalogId },
      {
        params: { ...this.workspaceParams(workspace) },
        headers: this.workspaceHeaders(workspace),
      }
    );
  }

  createProduct(
    workspace: StoreAuthoringWorkspace,
    input: CreateStoreProductInput
  ): Observable<StoreProduct> {
    return this.store.storeControllerCreateProduct<StoreProduct>(input, {
      params: this.workspaceParams(workspace),
      headers: this.workspaceHeaders(workspace),
    });
  }

  private workspaceParams(
    workspace: StoreAuthoringWorkspace
  ): Record<string, string> {
    // Plain record (not HttpParams): generated clients spread options into
    // the request params, which drops HttpParams internals.
    return { workspaceSlug: this.requireWorkspace(workspace) };
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
