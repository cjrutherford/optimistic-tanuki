import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  BusinessApiService,
  BusinessStoreProduct,
  BusinessAuthService,
} from '@optimistic-tanuki/business-data-access';
import {
  CheckboxComponent,
  SelectComponent,
  TextAreaComponent,
  TextInputComponent,
} from '@optimistic-tanuki/form-ui';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { switchMap } from 'rxjs';

type ProductForm = {
  id?: string;
  name: string;
  description: string;
  price: number;
  type: string;
  imageUrl: string;
  stock: number;
  active: boolean;
};

@Component({
  selector: 'business-owner-products-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    CardComponent,
    TextInputComponent,
    TextAreaComponent,
    SelectComponent,
    CheckboxComponent,
    RouterLink,
  ],
  template: `
    <section class="products-studio">
      <otui-card class="headline-card">
        <div class="headline-copy">
          <p class="eyebrow">Products</p>
          <h1>Manage offers and services</h1>
          <p class="headline-body">
            Create and update the service offerings clients can book from your
            public site.
          </p>
        </div>
      </otui-card>

      <div class="workspace-grid">
        <otui-card class="form-card">
          <div class="section-head">
            <div>
              <p class="eyebrow">{{ editingId() ? 'Edit' : 'New' }} product</p>
              <h2>{{ editingId() ? 'Update' : 'Create' }} offer</h2>
            </div>
          </div>

          <form class="product-form" (ngSubmit)="save()">
            <label>
              Name
              <lib-text-input
                [(ngModel)]="form().name"
                name="name"
                placeholder="Strategy Intensive"
              ></lib-text-input>
            </label>

            <label class="full">
              Description
              <lib-text-area
                [(ngModel)]="form().description"
                name="description"
                [rows]="3"
                placeholder="Describe what this engagement includes."
              ></lib-text-area>
            </label>

            <label>
              Price
              <lib-text-input
                [(ngModel)]="form().price"
                name="price"
                placeholder="150"
              ></lib-text-input>
            </label>

            <label>
              Type
              <lib-select
                [(ngModel)]="form().type"
                name="type"
                [options]="typeOptions"
              ></lib-select>
            </label>

            <label>
              Image URL
              <lib-text-input
                [(ngModel)]="form().imageUrl"
                name="imageUrl"
                placeholder="https://..."
              ></lib-text-input>
            </label>

            <label>
              Stock
              <lib-text-input
                [(ngModel)]="form().stock"
                name="stock"
                placeholder="0"
              ></lib-text-input>
            </label>

            <label class="toggle-row">
              <span>Active</span>
              <lib-checkbox
                [(ngModel)]="form().active"
                name="active"
              ></lib-checkbox>
            </label>

            <div class="form-actions">
              <otui-button type="submit" variant="primary">
                {{ editingId() ? 'Update' : 'Create' }}
              </otui-button>
              @if (editingId()) {
              <otui-button
                type="button"
                variant="outlined"
                [useGradient]="false"
                (action)="resetForm()"
              >
                Cancel
              </otui-button>
              }
            </div>
          </form>
        </otui-card>

        <otui-card class="list-card">
          <div class="section-head section-head-spread">
            <div>
              <p class="eyebrow">Catalog</p>
              <h2>Active offers</h2>
            </div>
            <span class="section-count">{{ visibleProducts().length }}</span>
          </div>

          <div class="product-list">
            @for (product of visibleProducts(); track product.id) {
            <div class="product-row">
              <div class="product-main">
                <strong>{{ product.name }}</strong>
                <p>{{ product.description || 'No description provided.' }}</p>
                <small
                  >{{ '$' + formatPrice(product.priceCents / 100) }} ·
                  {{ product.type }}</small
                >
              </div>
              <div class="row-actions">
                <a
                  class="row-view-link"
                  [routerLink]="productViewHref(product)"
                >
                  View
                </a>
                <otui-button variant="outlined" (action)="startEdit(product)">
                  Edit
                </otui-button>
                <otui-button
                  variant="text"
                  [useGradient]="false"
                  (action)="removeProduct(product)"
                >
                  Remove
                </otui-button>
              </div>
            </div>
            } @empty {
            <p class="empty">
              No products yet. Create your first offer using the form.
            </p>
            }
          </div>
        </otui-card>
      </div>
    </section>
  `,
  styles: [
    `
      .products-studio {
        display: grid;
        gap: 1.2rem;
      }
      .headline-card {
        padding: 1.3rem 1.35rem;
        border-radius: 1.5rem;
        background: radial-gradient(
            circle at top left,
            color-mix(in srgb, var(--primary) 14%, transparent),
            transparent 38%
          ),
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--primary) 8%, white),
            var(--background)
          );
      }
      .headline-copy {
        display: grid;
        gap: 0.55rem;
      }
      .headline-copy h1 {
        margin: 0;
        font-family: var(--font-heading, 'Baskervville', serif);
        font-weight: 700;
        line-height: 0.98;
        font-size: clamp(2rem, 3vw, 2.6rem);
      }
      .headline-body {
        margin: 0;
        max-width: 54ch;
        color: color-mix(in srgb, var(--foreground) 72%, transparent);
      }
      .workspace-grid {
        display: grid;
        grid-template-columns: minmax(320px, 400px) minmax(0, 1fr);
        gap: 1rem;
        align-items: start;
      }
      .form-card,
      .list-card {
        padding: 1.15rem;
        border-radius: 1.35rem;
        background: var(--background);
        border: 1px solid var(--border);
      }
      .section-head {
        display: grid;
        gap: 0.35rem;
        margin-bottom: 1rem;
      }
      .section-head-spread {
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
      }
      .section-head h2 {
        margin: 0;
        font-family: var(--font-heading, 'Baskervville', serif);
      }
      .eyebrow {
        margin: 0;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--primary);
      }
      .section-count {
        padding: 0.35rem 0.65rem;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--foreground) 5%, transparent);
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--muted);
      }
      .product-form {
        display: grid;
        gap: 0.9rem;
      }
      label {
        display: grid;
        gap: 0.35rem;
        font-weight: 600;
        font-size: 0.9rem;
        color: var(--foreground);
      }
      label.full {
        grid-column: 1 / -1;
      }
      .toggle-row {
        grid-template-columns: auto 1fr;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
      }
      .form-actions {
        display: flex;
        gap: 0.6rem;
        flex-wrap: wrap;
      }
      .product-list {
        display: grid;
        gap: 0.85rem;
      }
      .product-row {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.95rem 1rem;
        border-radius: 1rem;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--background) 96%, white);
        align-items: start;
      }
      .product-main {
        display: grid;
        gap: 0.35rem;
      }
      .product-main strong {
        font-weight: 700;
        color: var(--foreground);
      }
      .product-main p {
        margin: 0;
        color: var(--muted);
        font-size: 0.92rem;
      }
      .product-main small {
        color: var(--muted);
        font-weight: 600;
      }
      .row-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .row-view-link {
        align-self: center;
        color: var(--primary);
        font-size: 0.9rem;
        font-weight: 800;
        text-decoration: none;
      }

      .row-view-link:hover {
        text-decoration: underline;
      }

      .empty {
        margin: 0;
        color: var(--muted);
      }
      @media (max-width: 980px) {
        .workspace-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class BusinessOwnerProductsPageComponent {
  private readonly api = inject(BusinessApiService);
  private readonly auth = inject(BusinessAuthService);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly siteSlug = this.route?.snapshot.paramMap.get('siteSlug');
  private readonly ownerId = computed(() => this.auth.user()?.userId ?? null);
  private readonly ownerProductsSignal = toSignal(
    toObservable(this.ownerId).pipe(
      switchMap((ownerId) =>
        ownerId
          ? this.api.getOwnerProducts(ownerId)
          : this.api.getStoreProducts()
      )
    ),
    { initialValue: [] as BusinessStoreProduct[] }
  );
  readonly ownerProducts = computed(() => this.ownerProductsSignal() ?? []);
  readonly visibleProducts = computed(() => this.ownerProducts());
  readonly editingId = signal<string | null>(null);
  readonly form = signal<ProductForm>(emptyForm());
  readonly typeOptions = [
    { value: 'physical', label: 'Physical' },
    { value: 'digital', label: 'Digital' },
    { value: 'subscription', label: 'Subscription' },
    { value: 'donation', label: 'Donation' },
    { value: 'service', label: 'Service' },
  ];

  constructor() {}

  save(): void {
    if (this.editingId()) {
      return;
    }
  }

  startEdit(product: BusinessStoreProduct): void {
    this.editingId.set(product.id);
    this.form.set({
      id: product.id,
      name: product.name,
      description: product.description ?? '',
      price: product.priceCents / 100,
      type: product.type,
      imageUrl: product.imageUrl ?? '',
      stock: product.stock,
      active: product.active,
    });
  }

  productViewHref(product: BusinessStoreProduct): string[] {
    return this.siteSlug
      ? ['/sites', this.siteSlug, 'products', product.id]
      : ['/products', product.id];
  }

  removeProduct(product: BusinessStoreProduct): void {
    if (!confirm(`Delete "${product.name}"?`)) {
      return;
    }
  }

  resetForm(): void {
    this.editingId.set(null);
    this.form.set(emptyForm());
  }

  formatPrice(price: number): string {
    return price.toFixed(2);
  }
}

function emptyForm(): ProductForm {
  return {
    name: '',
    description: '',
    price: 0,
    type: 'physical',
    imageUrl: '',
    stock: 0,
    active: true,
  };
}
