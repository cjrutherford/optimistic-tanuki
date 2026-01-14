import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ShoppingCartComponent, CartItem } from '@optimistic-tanuki/store-ui';
import { Router } from '@angular/router';

@Component({
  selector: 'store-cart',
  standalone: true,
  imports: [CommonModule, ShoppingCartComponent],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss'],
})
export class CartComponent {
  items: CartItem[] = [
    {
      productId: '1',
      name: 'Premium Coffee Beans',
      price: 24.99,
      quantity: 2,
      imageUrl: '/assets/products/coffee.jpg',
    },
    {
      productId: '4',
      name: 'Handcrafted Mug',
      price: 14.99,
      quantity: 1,
      imageUrl: '/assets/products/mug.jpg',
    },
  ];

  constructor(private router: Router) {}

  onUpdateQuantity(event: { productId: string; quantity: number }): void {
    const item = this.items.find((i) => i.productId === event.productId);
    if (item) {
      item.quantity = event.quantity;
    }
  }

  onRemoveItem(productId: string): void {
    this.items = this.items.filter((i) => i.productId !== productId);
  }

  onCheckout(): void {
    this.router.navigate(['/checkout']);
  }
}
