import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ProductListComponent, Product } from '@optimistic-tanuki/store-ui';
import { Router } from '@angular/router';
import { StoreService } from '../../services/store.service';

@Component({
  selector: 'store-catalog',
  standalone: true,
  imports: [CommonModule, ProductListComponent],
  templateUrl: './catalog.component.html',
  styleUrls: ['./catalog.component.scss'],
})
export class CatalogComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  products: Product[] = [];
  loading = false;
  error: string | null = null;

  constructor(private router: Router, private storeService: StoreService) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.loadProducts();
  }

  loadProducts(): void {
    this.loading = true;
    this.error = null;
    this.storeService.getProducts().subscribe({
      next: (products) => {
        this.products = products;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading products:', err);
        this.error = 'Failed to load products. Please try again later.';
        this.loading = false;
      },
    });
  }

  onAddToCart(product: Product): void {
    // For now, just navigate to cart
    // In a real app, this would add to a cart service
    console.log('Adding to cart:', product);
    this.router.navigate(['/cart']);
  }
}
