import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeHostBindingsDirective, Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

@Component({
  selector: 'store-shopping-cart',
  standalone: true,
  imports: [CommonModule, ThemeHostBindingsDirective],
  templateUrl: './shopping-cart.component.html',
  styleUrls: ['./shopping-cart.component.scss'],
  hostDirectives: [ThemeHostBindingsDirective],
})
export class ShoppingCartComponent extends Themeable {
  @Input() items: CartItem[] = [];
  @Output() updateQuantity = new EventEmitter<{ productId: string; quantity: number }>();
  @Output() removeItem = new EventEmitter<string>();
  @Output() checkout = new EventEmitter<void>();

  get total(): number {
    return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  onQuantityChange(productId: string, quantity: number): void {
    if (quantity > 0) {
      this.updateQuantity.emit({ productId, quantity });
    }
  }

  onRemoveItem(productId: string): void {
    this.removeItem.emit(productId);
  }

  onCheckout(): void {
    this.checkout.emit();
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
