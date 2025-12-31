import { Component } from '@angular/core';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';

@Component({
  selector: 'store-store-ui',
  standalone: true,
  templateUrl: './store-ui.component.html',
  styleUrls: ['./store-ui.component.css'],
})
export class StoreUiComponent extends Themeable {
  // Provide a simple theme application for the root store UI
  applyTheme(colors: ThemeColors): void {
    this.setLocalCSSVariables({
      accent: colors.accent,
      complement: colors.complementary,
      background: colors.background,
      foreground: colors.foreground,
    });
  }
}
