import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-ui';

@Component({
  selector: 'otui-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './button.component.html',
  styleUrls: ['./button.component.scss'],
  host: {
    'class.theme': 'theme',
    '[style.--background]': 'background',
    '[style.--foreground]': 'foreground',
    '[style.--accent]': 'accent',
    '[style.--complement]': 'complement',
    '[style.--border-color]': 'borderColor',
    '[style.--border-gradient]': 'borderGradient',
    '[style.--transition-duration]': 'transitionDuration',
    '[style.--success]': 'success',
    '[style.--warning]': 'warning',
    '[style.--danger]': 'danger',
  }
})
/**
 * A reusable button component with theming capabilities.
 */
export class ButtonComponent extends Themeable {
  /**
   * The success color from the theme.
   */
  success!: string;
  /**
   * The warning color from the theme.
   */
  warning!: string;
  /**
   * The danger color from the theme.
   */
  danger!: string;
  /**
   * Whether the button is disabled.
   */
  @Input() disabled = false;
  /**
   * The visual variant of the button.
   */
  @Input() variant: 'primary' | 'secondary' | 'outlined' | 'text' | 'warning' | 'danger' | 'success' | 'rounded' = 'primary';
  /**
   * Emits when the button is clicked.
   */
  @Output() action = new EventEmitter<void>();

  /**
   * Applies the given theme colors to the button's styles.
   * @param colors The theme colors to apply.
   */
  override applyTheme(colors: ThemeColors): void {
    this.background = `linear-gradient(to bottom, ${colors.background}, ${colors.accent})`;
    this.foreground = colors.foreground;
    this.accent = colors.accent;
    this.complement = colors.complementary;
    this.success = colors.success;
    this.warning = colors.warning;
    this.danger = colors.danger;
    if (this.theme === 'dark') {
      this.borderGradient = colors.complementaryGradients['dark'];
      this.borderColor = colors.complementaryShades[6][1];
    } else {
      this.borderGradient = colors.accentGradients['light'];
      this.borderColor = colors.complementaryShades[2][1];
    }
    this.transitionDuration = '0.3s';
  }

  /**
   * Handles the button click event.
   */
  onClick() {
    if (!this.disabled) {
      this.action.emit();
    }
  }
}
