import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CreateStoreProductInput,
  StoreAuthoringDataService,
  StoreCatalog,
  StoreProduct,
  StoreAuthoringWorkspace,
} from '@optimistic-tanuki/store-data-access';

export type ProductAuthoringState =
  | 'loading'
  | 'denied'
  | 'empty'
  | 'ready'
  | 'error';

@Component({
  selector: 'ot-store-authoring-shell',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="authoring-shell" aria-labelledby="store-authoring-title">
      <p class="eyebrow">Workspace authoring</p>
      <h2 id="store-authoring-title">Store catalog</h2>
      <p class="context">Workspace: {{ workspaceId }}</p>
      @switch (authoringState()) { @case ('loading') {
      <p role="status">Loading catalog authoring…</p>
      } @case ('denied') {
      <p data-authoring-denied role="alert">
        Store authoring is not available for this workspace.
      </p>
      } @case ('error') {
      <p role="alert">Store authoring could not be loaded. Try again.</p>
      } @case ('empty') { @if (catalogs().length === 0) {
      <div data-authoring-empty>
        <p>No catalogs yet. Create one to start authoring products.</p>
        <div class="forms">
          <label>
            New catalog
            <input
              data-catalog-name
              [(ngModel)]="catalogName"
              placeholder="Catalog name"
            />
          </label>
          <button type="button" data-create-catalog (click)="createCatalog()">
            Create catalog
          </button>
        </div>
      </div>
      } } @case ('ready') {
      <div class="toolbar">
        <label>
          Catalog
          <select
            [ngModel]="selectedCatalogId()"
            (ngModelChange)="selectCatalog($event)"
          >
            @for (catalog of catalogs(); track catalog.id) {
            <option [value]="catalog.id">{{ catalog.name }}</option>
            }
          </select>
        </label>
      </div>
      <div class="forms">
        <label>
          New catalog
          <input
            data-catalog-name
            [(ngModel)]="catalogName"
            placeholder="Catalog name"
          />
        </label>
        <button type="button" data-create-catalog (click)="createCatalog()">
          Create catalog
        </button>
      </div>
      <div class="products" data-authoring-ready>
        <h3>{{ selectedCatalog()?.name }}</h3>
        @if (products().length === 0) {
        <p>No products in this catalog yet.</p>
        } @else {
        <ul>
          @for (product of products(); track product.id) {
          <li>
            {{ product.name }} · {{ product.priceCents / 100 | currency }}
          </li>
          }
        </ul>
        }
        <div class="forms">
          <label>
            New product
            <input
              data-product-name
              [(ngModel)]="productName"
              placeholder="Product name"
            />
          </label>
          <label>
            Price in cents
            <input type="number" [(ngModel)]="productPriceCents" />
          </label>
          <button type="button" data-create-product (click)="createProduct()">
            Create product
          </button>
        </div>
      </div>
      } }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .authoring-shell {
        padding: 1.25rem;
        border: 1px solid var(--border, #d7dce5);
        border-radius: 1rem;
        background: var(--surface, #fff);
      }
      .eyebrow {
        margin: 0;
        color: var(--primary, #315fdd);
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .context {
        color: var(--muted, #64748b);
      }
      button {
        padding: 0.55rem 0.8rem;
        border: 0;
        border-radius: 0.5rem;
        background: var(--primary, #315fdd);
        color: #fff;
        font-weight: 700;
      }
      .toolbar,
      .forms {
        display: flex;
        flex-wrap: wrap;
        align-items: end;
        gap: 0.75rem;
        margin-top: 1rem;
      }
      label {
        display: grid;
        gap: 0.35rem;
        font-weight: 600;
      }
      input,
      select {
        min-width: 12rem;
        padding: 0.55rem;
        border: 1px solid var(--border, #d7dce5);
        border-radius: 0.45rem;
      }
      .products {
        margin-top: 1.5rem;
      }
    `,
  ],
})
export class StoreAuthoringShellComponent implements OnInit {
  private readonly data = inject(StoreAuthoringDataService);
  @Input({ required: true }) workspaceId = '';
  @Input({ required: true }) workspaceSlug = '';
  @Input() state?: ProductAuthoringState;

  readonly authoringState = signal<ProductAuthoringState>('loading');
  readonly catalogs = signal<StoreCatalog[]>([]);
  readonly products = signal<StoreProduct[]>([]);
  readonly selectedCatalogId = signal('');
  catalogName = '';
  productName = '';
  productPriceCents = 0;

  ngOnInit(): void {
    if (!this.workspaceId.trim() || !this.workspaceSlug.trim()) {
      this.authoringState.set('denied');
      return;
    }
    this.loadCatalogs();
  }

  selectedCatalog(): StoreCatalog | undefined {
    return this.catalogs().find(
      (catalog) => catalog.id === this.selectedCatalogId()
    );
  }

  selectCatalog(catalogId: string): void {
    this.selectedCatalogId.set(catalogId);
    this.loadProducts(catalogId);
  }

  createCatalog(): void {
    const name = this.catalogName.trim();
    if (!name) return;
    this.data.createCatalog(this.workspaceContext(), { name }).subscribe({
      next: (catalog) => {
        this.catalogName = '';
        this.catalogs.update((catalogs) => [...catalogs, catalog]);
        this.selectCatalog(catalog.id);
      },
      error: () => this.authoringState.set('error'),
    });
  }

  createProduct(): void {
    const catalogId = this.selectedCatalogId();
    const name = this.productName.trim();
    if (!catalogId || !name) return;
    const input: CreateStoreProductInput = {
      name,
      priceCents: Number(this.productPriceCents),
      type: 'physical',
      catalogId,
    };
    this.data.createProduct(this.workspaceContext(), input).subscribe({
      next: (product) => {
        this.productName = '';
        this.products.update((products) => [...products, product]);
      },
      error: () => this.authoringState.set('error'),
    });
  }

  private loadCatalogs(): void {
    this.data.listCatalogs(this.workspaceContext()).subscribe({
      next: (catalogs) => {
        this.catalogs.set(catalogs);
        if (catalogs.length === 0) {
          this.authoringState.set('empty');
          return;
        }
        this.selectedCatalogId.set(catalogs[0].id);
        this.loadProducts(catalogs[0].id);
      },
      error: () => this.authoringState.set('error'),
    });
  }

  private loadProducts(catalogId: string): void {
    this.data.listProducts(this.workspaceContext(), catalogId).subscribe({
      next: (products) => {
        this.products.set(products);
        this.authoringState.set('ready');
      },
      error: () => this.authoringState.set('error'),
    });
  }

  private workspaceContext(): StoreAuthoringWorkspace {
    return {
      workspaceId: this.workspaceId,
      workspaceSlug: this.workspaceSlug,
    };
  }
}
