import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeHostBindingsDirective } from '@optimistic-tanuki/theme-lib';

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  stock: number;
  type: string;
}

@Component({
  selector: 'store-product-card',
  standalone: true,
  imports: [CommonModule, ThemeHostBindingsDirective],
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.scss'],
  hostDirectives: [ThemeHostBindingsDirective],
})
export class ProductCardComponent {
  @Input() product!: Product;
  @Input() showAddToCart = true;
  @Output() addToCart = new EventEmitter<Product>();

  onAddToCart(): void {
    if (this.product.stock > 0) {
      this.addToCart.emit(this.product);
    }
  }
}
