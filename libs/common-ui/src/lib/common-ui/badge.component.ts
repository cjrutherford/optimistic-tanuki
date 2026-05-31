import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';

/**
 * Canonical badge tones. Map to the matching `--<tone>` and `--on-<tone>`
 * tokens written by ThemeService.
 */
export type BadgeTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'brand';

/**
 * Visual treatment.
 *
 * - `solid` — filled background, `--on-<tone>` foreground.
 * - `soft` — translucent background mixed from the tone, foreground = tone.
 * - `outline` — transparent background, bordered, foreground = tone.
 */
export type BadgeShape = 'solid' | 'soft' | 'outline';

export type BadgeSize = 'sm' | 'md' | 'lg';

/** @deprecated Use {@link BadgeTone}. Kept for back-compat. */
export type BadgeVariant =
  | 'success'
  | 'primary'
  | 'warning'
  | 'error'
  | 'neutral';

const VARIANT_TO_TONE: Record<BadgeVariant, BadgeTone> = {
  success: 'success',
  primary: 'brand',
  warning: 'warning',
  error: 'danger',
  neutral: 'neutral',
};

@Component({
  selector: 'otui-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './badge.component.html',
  styleUrls: ['./badge.component.scss'],
})
export class BadgeComponent extends Themeable {
  /** Semantic tone of the badge. Drives `--<tone>` / `--on-<tone>` tokens. */
  @Input() tone: BadgeTone = 'neutral';

  /**
   * Legacy alias retained for callers that still pass `variant`. New code
   * should set `tone` directly. When both are provided, `tone` wins.
   *
   * @deprecated Use `tone` instead.
   */
  @Input() set variant(value: BadgeVariant | undefined) {
    this._variant = value;
    if (value && this.tone === 'neutral') {
      this.tone = VARIANT_TO_TONE[value];
    }
  }
  get variant(): BadgeVariant | undefined {
    return this._variant;
  }
  private _variant?: BadgeVariant;

  /** Visual treatment. Defaults to `soft` for non-blocking inline use. */
  @Input() shape: BadgeShape = 'soft';

  @Input() size: BadgeSize = 'md';
  @Input() icon: 'check' | 'star' | 'shield' | 'none' = 'none';

  override applyTheme(colors: ThemeColors): void {
    // Bridge the legacy local CSS variables used by older badge styles.
    this.setLocalCSSVariables({
      'badge-success-bg': colors.success,
      'badge-primary-bg': colors.accent,
      'badge-warning-bg': colors.warning,
      'badge-error-bg': colors.danger,
    });
  }
}
