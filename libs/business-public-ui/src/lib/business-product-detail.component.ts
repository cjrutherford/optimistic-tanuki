import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  BusinessApiService,
  BusinessStoreProduct,
} from '@optimistic-tanuki/business-data-access';
import { ProductCardComponent } from '@optimistic-tanuki/store-ui';

@Component({
  selector: 'business-product-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCardComponent],
  template: `
    <article class="product-detail-page">
      <div class="detail-shell">
        <a class="back-link" [routerLink]="backRoute()">Back to site</a>

        @if (product(); as item) {
        <section class="product-detail-card">
          <div class="product-detail-media">
            <img
              [src]="item.imageUrl || '/assets/placeholder.png'"
              [alt]="item.name"
            />
          </div>
          <div class="product-detail-copy">
            <p class="eyebrow">Product</p>
            <h1>{{ item.name }}</h1>
            @if (item.description) {
            <p class="lede">{{ item.description }}</p>
            }
            <div class="product-meta">
              <span class="product-price"
                >\${{ formatPrice(item.priceCents / 100) }}</span
              >
              <span
                class="product-stock"
                [class.out-of-stock]="item.stock === 0"
              >
                {{ item.stock > 0 ? item.stock + ' in stock' : 'Out of stock' }}
              </span>
            </div>
            <store-product-card
              [product]="productCard(item)"
              [showAddToCart]="false"
              [viewProductHref]="null"
            ></store-product-card>
          </div>
        </section>
        } @else {
        <section class="product-detail-card unavailable">
          <p class="eyebrow">Product unavailable</p>
          <h1>Product not available</h1>
          <p>This product is not currently published for public viewing.</p>
          <a class="cta-primary" [routerLink]="backRoute()">Return to site</a>
        </section>
        }
      </div>
    </article>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .product-detail-page {
        display: grid;
        min-height: 70vh;
        padding: 2rem 1rem 4rem;
      }

      .detail-shell {
        width: min(1120px, 100%);
        margin: 0 auto;
        display: grid;
        gap: 1.25rem;
      }

      .back-link {
        justify-self: start;
        color: var(--primary);
        font-weight: 700;
        text-decoration: none;
      }

      .back-link:hover {
        text-decoration: underline;
      }

      .product-detail-card {
        display: grid;
        grid-template-columns: minmax(280px, 0.9fr) minmax(0, 1.1fr);
        gap: 1.5rem;
        padding: 1.25rem;
        border-radius: var(--personality-card-radius, 1.5rem);
        border: 1px solid var(--border);
        background: var(--background);
        box-shadow: var(
          --personality-card-shadow,
          0 16px 40px rgba(15, 23, 42, 0.08)
        );
      }

      .product-detail-card.unavailable {
        grid-template-columns: 1fr;
      }

      .product-detail-media {
        overflow: hidden;
        border-radius: calc(var(--personality-card-radius, 1.5rem) - 0.35rem);
        background: color-mix(in srgb, var(--primary) 8%, transparent);
      }

      .product-detail-media img {
        width: 100%;
        height: 100%;
        min-height: 360px;
        object-fit: cover;
        display: block;
      }

      .product-detail-copy {
        display: grid;
        gap: 1rem;
        align-content: start;
      }

      .product-detail-copy h1,
      .unavailable h1 {
        margin: 0;
        font-family: var(--font-heading, 'Baskervville', serif);
        font-size: clamp(2rem, 4vw, 4rem);
        line-height: 0.98;
      }

      .lede {
        margin: 0;
        color: var(--muted);
        font-size: 1.05rem;
        line-height: 1.6;
      }

      .eyebrow {
        margin: 0;
        color: var(--primary);
        font-size: 0.75rem;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .product-meta {
        display: flex;
        gap: 0.8rem;
        flex-wrap: wrap;
        align-items: center;
      }

      .product-price {
        font-size: 1.35rem;
        font-weight: 800;
      }

      .product-stock {
        padding: 0.35rem 0.65rem;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--background) 88%, transparent);
        color: var(--muted);
        font-size: 0.88rem;
        font-weight: 700;
      }

      .product-stock.out-of-stock {
        color: var(--danger);
        border-color: color-mix(in srgb, var(--danger) 25%, var(--border));
        background: color-mix(in srgb, var(--danger) 7%, transparent);
      }

      .cta-primary {
        justify-self: start;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 0.75rem 1.2rem;
        border-radius: var(--personality-button-radius, 999px);
        background: var(--primary);
        color: white;
        font-weight: 800;
        text-decoration: none;
      }

      @media (max-width: 840px) {
        .product-detail-card {
          grid-template-columns: 1fr;
        }

        .product-detail-media img {
          min-height: 240px;
        }
      }
    `,
  ],
})
export class BusinessProductDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(BusinessApiService);
  private readonly siteSlug = this.route.snapshot.paramMap.get('siteSlug');
  private readonly productId = this.route.snapshot.paramMap.get('productId');
  private readonly products = toSignal(this.api.getStoreProducts(), {
    initialValue: [],
  });

  readonly product = computed(() => {
    const product = this.products().find((item) => item.id === this.productId);
    return product?.active && product.type !== 'service' ? product : null;
  });

  backRoute(): string[] {
    return this.siteSlug
      ? ['/sites', this.siteSlug]
      : ['/sites', 'my-business'];
  }

  productCard(product: BusinessStoreProduct) {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      priceCents: product.priceCents,
      imageUrl: product.imageUrl,
      stock: product.stock,
      type: product.type,
    };
  }

  formatPrice(price: number): string {
    return price.toFixed(2);
  }
}
