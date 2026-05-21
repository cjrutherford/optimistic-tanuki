import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';

export type BadgeVariant = 'success' | 'primary' | 'warning' | 'error' | 'neutral';
export type BadgeSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'otui-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './badge.component.html',
  styleUrls: ['./badge.component.scss'],
})
export class BadgeComponent extends Themeable {
  @Input() variant: BadgeVariant = 'success';
  @Input() size: BadgeSize = 'md';
  @Input() icon: 'check' | 'star' | 'shield' | 'none' = 'none';

  override applyTheme(colors: ThemeColors): void {
    this.setLocalCSSVariables({
      'badge-success-bg': colors.success,
      'badge-primary-bg': colors.accent,
      'badge-warning-bg': colors.warning,
      'badge-error-bg': colors.danger,
    });
  }
}
