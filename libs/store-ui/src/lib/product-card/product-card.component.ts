import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeHostBindingsDirective, Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';

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
export class ProductCardComponent extends Themeable {
  @Input() product!: Product;
  @Input() showAddToCart = true;
  @Output() addToCart = new EventEmitter<Product>();

  onAddToCart(): void {
    if (this.product?.stock > 0) {
      this.addToCart.emit(this.product);
    }
  }

  // Concrete implementation required by Themeable
  applyTheme(colors: ThemeColors): void {
    // Map core theme colors into local CSS variables for component-scoped styling
    this.setLocalCSSVariables({
      accent: colors.accent,
      complement: colors.complementary,
      tertiary: colors.tertiary,
      background: colors.background,
      foreground: colors.foreground,
    });
  }
}
