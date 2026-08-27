/**
 * Canonical variant contract for common-ui primitives.
 *
 * Built on top of the theme + personality systems. The three axes are
 * orthogonal:
 *
 * - `tone`     — semantic color, bound to the `--<tone>` / `--on-<tone>`
 *                tokens emitted by `ThemeService`.
 * - `emphasis` — visual treatment of that tone (fill vs. tint vs. border).
 * - `size`     — physical scale.
 *
 * Personality remains authoritative for radius, border width/style, shadow
 * profile and fonts; the contract only owns tone color + emphasis treatment.
 */

/**
 * Semantic color tone. Each value resolves to a `--<tone>` background source
 * and an `--on-<tone>` foreground source in `_variant.scss`.
 *
 * - `brand`   maps onto `--primary` / `--on-primary`.
 * - `neutral` maps onto `--surface-variant` / `--foreground`.
 */
export type Tone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'brand';

/**
 * Visual treatment of the tone.
 *
 * - `solid`   — filled background, `--on-<tone>` foreground.
 * - `soft`    — translucent tone-mixed background, tone-colored foreground.
 * - `outline` — transparent background, tone-colored border + foreground.
 * - `ghost`   — transparent background, no border, tone-colored foreground.
 */
export type Emphasis = 'solid' | 'soft' | 'outline' | 'ghost';

/** Physical scale. */
export type VariantSize = 'sm' | 'md' | 'lg' | 'small' | 'large';

/** The full orthogonal variant contract shared by common-ui primitives. */
export interface VariantContract {
  tone: Tone;
  emphasis: Emphasis;
  size: VariantSize;
}

/** Partial subset of {@link VariantContract} used by legacy bridge maps. */
export type VariantBinding = Pick<VariantContract, 'tone' | 'emphasis'>;

/**
 * Legacy `button` string-union values mapped onto the canonical axes.
 * `rounded` additionally sets a pill radius flag on the component itself.
 */
export const BUTTON_VARIANT_BRIDGE: Record<string, VariantBinding> = {
  primary: { tone: 'brand', emphasis: 'solid' },
  secondary: { tone: 'neutral', emphasis: 'solid' },
  outlined: { tone: 'brand', emphasis: 'outline' },
  text: { tone: 'brand', emphasis: 'ghost' },
  warning: { tone: 'warning', emphasis: 'solid' },
  danger: { tone: 'danger', emphasis: 'solid' },
  success: { tone: 'success', emphasis: 'solid' },
  rounded: { tone: 'brand', emphasis: 'solid' },
};

/** Legacy `chip` string-union values mapped onto the canonical tone. */
export const CHIP_TONE_BRIDGE: Record<string, Tone> = {
  primary: 'brand',
  secondary: 'neutral',
  success: 'success',
  warning: 'warning',
  error: 'danger',
};

/**
 * Legacy `default | glass | gradient` surface values (accordion, modal) mapped
 * onto the canonical emphasis. `glass`/`gradient` additionally set a `surface`
 * flag on the component to preserve the frosted/gradient chrome.
 */
export const SURFACE_EMPHASIS_BRIDGE: Record<string, Emphasis> = {
  default: 'solid',
  glass: 'soft',
  gradient: 'soft',
};
