import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductListComponent, Product } from '@optimistic-tanuki/store-ui';
import { Router } from '@angular/router';

@Component({
  selector: 'store-catalog',
  standalone: true,
  imports: [CommonModule, ProductListComponent],
  templateUrl: './catalog.component.html',
  styleUrls: ['./catalog.component.scss'],
})
export class CatalogComponent {
  products: Product[] = [
    {
      id: '1',
      name: 'Premium Coffee Beans',
      description: 'Organic, fair-trade coffee beans from Colombia',
      price: 24.99,
      imageUrl: '/assets/products/coffee.jpg',
      stock: 50,
      type: 'physical',
    },
    {
      id: '2',
      name: 'E-Book: Web Development Guide',
      description: 'Complete guide to modern web development',
      price: 39.99,
      imageUrl: '/assets/products/ebook.jpg',
      stock: 999,
      type: 'digital',
    },
    {
      id: '3',
      name: 'Premium Subscription',
      description: 'Monthly access to all premium features',
      price: 9.99,
      imageUrl: '/assets/products/subscription.jpg',
      stock: 999,
      type: 'subscription',
    },
    {
      id: '4',
      name: 'Handcrafted Mug',
      description: 'Beautiful ceramic mug, handmade by local artisans',
      price: 14.99,
      imageUrl: '/assets/products/mug.jpg',
      stock: 25,
      type: 'physical',
    },
    {
      id: '5',
      name: 'Online Course Access',
      description: 'Lifetime access to our complete course library',
      price: 199.99,
      imageUrl: '/assets/products/course.jpg',
      stock: 999,
      type: 'digital',
    },
    {
      id: '6',
      name: 'T-Shirt',
      description: 'Comfortable cotton t-shirt with unique design',
      price: 29.99,
      imageUrl: '/assets/products/tshirt.jpg',
      stock: 15,
      type: 'physical',
    },
  ];

  constructor(private router: Router) {}

  onAddToCart(product: Product): void {
    // For now, just navigate to cart
    // In a real app, this would add to a cart service
    console.log('Adding to cart:', product);
    this.router.navigate(['/cart']);
  }
}
