import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';

@Component({
  selector: 'otui-chip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chip.component.html',
  styleUrls: ['./chip.component.scss'],
  host: {
    '[class.theme]': 'theme',
    '[class.chip-deletable]': 'deletable',
  },
})
export class ChipComponent extends Themeable {
  @Input() variant: 'primary' | 'secondary' | 'success' | 'warning' | 'error' =
    'primary';
  @Input() deletable = false;
  @Input() disabled = false;
  @Output() delete = new EventEmitter<void>();

  override applyTheme(colors: ThemeColors): void {
    this.setLocalCSSVariables({
      'chip-primary-bg': `${colors.accent}20`,
      'chip-primary-color': colors.accent,
      'chip-secondary-bg': `${colors.complementary}20`,
      'chip-secondary-color': colors.complementary,
      'chip-success-bg': colors.success,
      'chip-warning-bg': colors.warning,
      'chip-error-bg': colors.danger,
    });
  }

  onDelete(event: Event): void {
    event.stopPropagation();
    if (!this.disabled) {
      this.delete.emit();
    }
  }
}
