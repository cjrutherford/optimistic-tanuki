import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  ProductCardComponent,
  ProductListComponent,
  ShoppingCartComponent,
  DonationComponent,
} from '@optimistic-tanuki/store-ui';
import {
  PageShellComponent,
  ElementCardComponent,
  IndexChipComponent,
  PlaygroundElement,
  ElementConfig,
} from '../../shared';

@Component({
  selector: 'pg-store-ui-page',
  standalone: true,
  imports: [
    CommonModule,
    PageShellComponent,
    ElementCardComponent,
    IndexChipComponent,
    ProductCardComponent,
    ProductListComponent,
    ShoppingCartComponent,
    DonationComponent,
  ],
  template: `
    <pg-page-shell
      packageName="@optimistic-tanuki/store-ui"
      title="Store UI"
      description="E-commerce components for product display, shopping carts, and donations."
      [importSnippet]="importSnippet"
    >
      <ng-container slot="index">
        @for (el of elements; track el.id) {
        <pg-index-chip [id]="el.id" [label]="el.selector" />
        }
      </ng-container>

      @for (el of elements; track el.id) {
      <pg-element-card
        [element]="el"
        [config]="configs[el.id]"
        (configChange)="configs[el.id] = $event"
        (reset)="resetConfig(el.id)"
      >
        @switch (el.id) { @case ('product-card') {
        <div class="preview-centered">
          <store-product-card [product]="sampleProduct" />
        </div>
        } @case ('product-list') {
        <div class="preview-padded">
          <store-product-list [products]="sampleProducts" />
        </div>
        } @case ('shopping-cart') {
        <div class="preview-padded">
          <store-shopping-cart [items]="sampleCartItems" />
        </div>
        } @case ('donation') {
        <div class="preview-centered">
          <store-donation />
        </div>
        } }
      </pg-element-card>
      }
    </pg-page-shell>
  `,
  styles: [
    `
      .preview-centered {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 300px;
        padding: 1.5rem;
      }

      .preview-padded {
        padding: 1.5rem;
        min-height: 200px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoreUiPageComponent {
  readonly importSnippet = `import { ProductCardComponent, ProductListComponent, ShoppingCartComponent, DonationComponent } from '@optimistic-tanuki/store-ui';`;

  configs: Record<string, ElementConfig> = {};

  readonly sampleProduct = {
    id: '1',
    name: 'Sample Product',
    description: 'A great product for the playground demo.',
    price: 29.99,
    imageUrl: '',
    stock: 10,
    type: 'digital',
  };

  readonly sampleProducts = [
    { id: '1', name: 'Product 1', price: 19.99, imageUrl: '', stock: 5, type: 'physical' },
    { id: '2', name: 'Product 2', price: 39.99, imageUrl: '', stock: 3, type: 'digital' },
  ];

  readonly sampleCartItems = [
    { productId: '1', name: 'Product 1', price: 19.99, quantity: 2 },
  ];

  readonly elements: PlaygroundElement[] = [
    {
      id: 'product-card',
      title: 'Product Card',
      headline: 'Product display card',
      importName: 'ProductCardComponent',
      selector: 'store-product-card',
      summary: 'Card displaying product info with add to cart.',
      props: [
        { name: 'product', type: 'Product', defaultValue: '{}', description: 'Product data object.' },
      ],
    },
    {
      id: 'product-list',
      title: 'Product List',
      headline: 'Grid of products',
      importName: 'ProductListComponent',
      selector: 'store-product-list',
      summary: 'Responsive grid of product cards.',
      props: [
        { name: 'products', type: 'Product[]', defaultValue: '[]', description: 'Array of products.' },
      ],
    },
    {
      id: 'shopping-cart',
      title: 'Shopping Cart',
      headline: 'Cart with items',
      importName: 'ShoppingCartComponent',
      selector: 'store-shopping-cart',
      summary: 'Shopping cart display with totals.',
      props: [
        { name: 'items', type: 'CartItem[]', defaultValue: '[]', description: 'Cart items array.' },
      ],
    },
    {
      id: 'donation',
      title: 'Donation',
      headline: 'Donation widget',
      importName: 'DonationComponent',
      selector: 'store-donation',
      summary: 'Donation form with preset amounts.',
      props: [],
    },
  ];

  constructor() {
    this.initConfigs();
  }

  private initConfigs(): void {
    for (const el of this.elements) {
      this.configs[el.id] = {};
    }
  }

  resetConfig(id: string): void {
    this.configs[id] = {};
  }
}
