import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';

@Component({
  selector: 'otui-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './button.component.html',
  styleUrls: ['./button.component.scss'],
  host: {
    'class.theme': 'theme',
    '[class.variant-primary]': 'variant === "primary"',
    '[class.variant-secondary]': 'variant === "secondary"',
    '[class.variant-outlined]': 'variant === "outlined"',
    '[class.variant-text]': 'variant === "text"',
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
    '[style.--button-gradient]': 'buttonGradient',
    '[style.--animation-easing]': 'animationEasing',
    '[style.--animation-duration]': 'animationDuration',
  },
})
export class ButtonComponent extends Themeable {
  @Input() disabled = false;
  @Input() variant:
    | 'primary'
    | 'secondary'
    | 'outlined'
    | 'text'
    | 'warning'
    | 'danger'
    | 'success'
    | 'rounded' = 'primary';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() useGradient = true;
  @Output() action = new EventEmitter<void>();

  buttonGradient = 'none';
  animationEasing = 'cubic-bezier(0.4, 0, 0.2, 1)';
  animationDuration = '300ms';

  override applyTheme(colors: ThemeColors): void {
    this.foreground = colors.foreground;
    this.accent = colors.accent;
    this.complement = colors.complementary;
    this.success = colors.success;
    this.warning = colors.warning;
    this.danger = colors.danger;
    this.transitionDuration = '300ms';

    const animationSettings = this.themeService.getAnimationSettings();
    this.animationEasing = animationSettings.easing;
    this.animationDuration = animationSettings.duration;

    this.updateButtonStyle(colors);
  }

  private updateButtonStyle(colors: ThemeColors): void {
    switch (this.variant) {
      case 'primary':
        if (this.useGradient) {
          this.buttonGradient = this.themeService.getButtonGradient('primary');
          this.background = 'var(--button-gradient)';
        } else {
          this.background = colors.accent;
        }
        this.borderColor = 'transparent';
        break;

      case 'secondary':
        if (this.useGradient) {
          this.buttonGradient =
            this.themeService.getButtonGradient('secondary');
          this.background = 'var(--button-gradient)';
        } else {
          this.background = colors.complementary;
        }
        this.borderColor = 'transparent';
        break;

      case 'outlined':
        this.background = 'transparent';
        this.borderColor = colors.accent;
        break;

      case 'text':
        this.background = 'transparent';
        this.borderColor = 'transparent';
        break;

      case 'warning':
        this.background = colors.warning;
        this.borderColor = 'transparent';
        break;

      case 'danger':
        this.background = colors.danger;
        this.borderColor = 'transparent';
        break;

      case 'success':
        this.background = colors.success;
        this.borderColor = 'transparent';
        break;

      case 'rounded':
        if (this.useGradient) {
          this.buttonGradient = this.themeService.getButtonGradient('primary');
          this.background = 'var(--button-gradient)';
        } else {
          this.background = colors.accent;
        }
        this.borderColor = 'transparent';
        break;
    }
  }

  onClick() {
    if (!this.disabled) {
      this.action.emit();
    }
  }
}
