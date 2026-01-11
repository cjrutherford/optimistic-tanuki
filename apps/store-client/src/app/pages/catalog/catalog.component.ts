import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  products: Product[] = [];
  loading = false;
  error: string | null = null;

  constructor(
    private router: Router,
    private storeService: StoreService
  ) {}

  ngOnInit(): void {
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
