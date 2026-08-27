import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';
import {
  BUTTON_VARIANT_BRIDGE,
  type Emphasis,
  type Tone,
  type VariantSize,
} from '../interfaces/variant.contract';

/** @deprecated Use the canonical `tone` + `emphasis` axes instead. */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outlined'
  | 'text'
  | 'warning'
  | 'danger'
  | 'success'
  | 'rounded';

@Component({
  selector: 'otui-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './button.component.html',
  styleUrls: ['./button.component.scss'],
  host: {
    'class.theme': 'theme',
    '[attr.data-tone]': 'tone',
    '[attr.data-emphasis]': 'emphasis',
    '[attr.data-size]': 'size',
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

  /** Canonical semantic tone. */
  @Input() tone: Tone = 'brand';
  /** Canonical visual treatment. */
  @Input() emphasis: Emphasis = 'solid';
  /** Canonical physical scale. */
  @Input() size: VariantSize = 'md';

  /**
   * Legacy string-union treatment. Retained for the hundreds of existing
   * `<otui-button variant="...">` usages; setting it maps onto the canonical
   * `tone` + `emphasis` axes via {@link BUTTON_VARIANT_BRIDGE}.
   *
   * @deprecated Use `tone` + `emphasis` instead.
   */
  @Input() set variant(value: ButtonVariant) {
    this._variant = value;
    const binding = BUTTON_VARIANT_BRIDGE[value];
    if (binding) {
      this.tone = binding.tone;
      this.emphasis = binding.emphasis;
    }
  }
  get variant(): ButtonVariant {
    return this._variant;
  }
  private _variant: ButtonVariant = 'primary';

  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() useGradient = true;
  @Output() action = new EventEmitter<void>();

  buttonGradient = 'none';
  animationEasing = 'cubic-bezier(0.4, 0, 0.2, 1)';
  animationDuration = '300ms';

  /**
   * True when the flagship brand gradient should paint the surface: brand tone,
   * solid emphasis, gradient opt-in. Bound as a class so SCSS can rebind
   * `--variant-bg-source` to the personality gradient.
   */
  get gradientActive(): boolean {
    return (
      this.useGradient && this.tone === 'brand' && this.emphasis === 'solid'
    );
  }

  /** Pill treatment carried over from the legacy `rounded` variant. */
  get isRounded(): boolean {
    return this._variant === 'rounded';
  }

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

    // Compute the personality-driven brand gradient once; SCSS decides whether
    // to paint with it via the `use-gradient` class.
    this.buttonGradient = this.themeService.getButtonGradient('primary');
  }

  onClick() {
    if (!this.disabled) {
      this.action.emit();
    }
  }
}
