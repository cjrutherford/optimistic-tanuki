import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ProductCardComponent,
  Product,
} from '../product-card/product-card.component';
import {
  ThemeHostBindingsDirective,
  Themeable,
  ThemeColors,
} from '@optimistic-tanuki/theme-lib';

@Component({
  selector: 'store-product-list',
  standalone: true,
  imports: [CommonModule, ProductCardComponent, ThemeHostBindingsDirective],
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss'],
  hostDirectives: [ThemeHostBindingsDirective],
})
export class ProductListComponent extends Themeable {
  @Input() products: Product[] = [];
  @Input() columns = 3;
  @Output() addToCart = new EventEmitter<Product>();

  onAddToCart(product: Product): void {
    this.addToCart.emit(product);
  }
  // Implement Themeable
  applyTheme(colors: ThemeColors): void {
    this.setLocalCSSVariables({
      accent: colors.accent,
      complement: colors.complementary,
      background: colors.background,
      foreground: colors.foreground,
    });
  }
}
