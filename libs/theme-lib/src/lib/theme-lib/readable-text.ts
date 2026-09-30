import { getContrastRatio, isHex, mix } from '@optimistic-tanuki/theme-models';

/** WCAG AA for body-size text. */
export const READABLE_TEXT_RATIO = 4.5;

/**
 * What the resolver aims for: a little above AA, because the browser's own
 * colour maths (oklab color-mix, 8-bit rounding) can land a hair under an
 * exact 4.5 (seen as 4.47-4.49 in rendered captures).
 */
const TARGET_RATIO = 4.6;

/**
 * `color`, moved toward black or white just far enough to reach `ratio`
 * against every background (the page and the surface it may sit on).
 * Unchanged when it already passes.
 */
export function readableOn(
  color: string,
  backgrounds: readonly string[],
  ratio = READABLE_TEXT_RATIO
): string {
  const passes = (c: string) =>
    backgrounds.every((bg) => getContrastRatio(c, bg) >= ratio);
  if (passes(color)) return color;
  // Move toward whichever extreme reads better on these backgrounds.
  const worst = (c: string) =>
    Math.min(...backgrounds.map((bg) => getContrastRatio(c, bg)));
  const target = worst('#ffffff') >= worst('#000000') ? '#ffffff' : '#000000';
  for (let step = 1; step <= 20; step++) {
    const candidate = mix(target, color, step / 20);
    if (passes(candidate)) return candidate;
  }
  return target;
}

/**
 * The colours a gradient `fill` (as emitted by the atmosphere layer: rgba()
 * stops and `transparent`) actually shows once painted over `base`.
 */
export function fillColorsOver(
  fill: string | undefined,
  base: string
): string[] {
  if (!fill) return [];
  return [...fill.matchAll(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/g)].map(
    ([, r, g, b, a]) => {
      const hex = `#${[r, g, b]
        .map((c) => Number(c).toString(16).padStart(2, '0'))
        .join('')}`;
      return mix(hex, base, Number(a));
    }
  );
}

/** Tones whose colour is also drawn as text (outline/ghost/soft emphases, links). */
export const TEXT_TONES = [
  'primary',
  'secondary',
  'success',
  'warning',
  'danger',
  'info',
] as const;

/**
 * Text colours guaranteed readable on the final page and surface:
 * - `--<tone>-text` (e.g. `--primary-text`): the tone, for text drawn in that
 *   colour (links, active tabs, outlined/text buttons, chips, soft badges).
 *   `--<tone>` itself stays the fill colour; components read
 *   `var(--<tone>-text, var(--<tone>))`.
 * - `--muted-foreground`: lifted toward the text colour when it falls short.
 * Runs last, after the personality extension layer, so it holds for every
 * ground and surface a personality chooses.
 */
export function resolveReadableText(
  vars: Readonly<Record<string, string>>
): Record<string, string> {
  const page = vars['--background'];
  const surface = vars['--surface'] || page;
  if (![page, surface].every((c) => c && isHex(c))) return {};
  const out: Record<string, string> = {};
  // Everything text may sit on: the page and its atmosphere backdrop, the
  // surface and its finish (sheen / gradient / raised fills).
  const grounds = [
    page,
    surface,
    ...fillColorsOver(vars['--atmosphere-backdrop'], page),
    ...fillColorsOver(vars['--surface-fill'], surface),
  ];
  // Tone text sits on the page, on surfaces, and on the tone's own soft tint
  // (the `soft` emphasis mixes 18% of the tone over its container, in oklab;
  // 25% here covers the difference from this sRGB mix).
  for (const tone of TEXT_TONES) {
    const color = vars[`--${tone}`];
    if (!color || !isHex(color)) continue;
    // The grounds must pass; the soft tints too whenever that is possible
    // (a near-white tone in dark mode can't also read on its own light tint).
    const withTints = readableOn(
      color,
      [...grounds, ...grounds.map((g) => mix(color, g, 0.25))],
      TARGET_RATIO
    );
    out[`--${tone}-text`] = grounds.every(
      (g) => getContrastRatio(withTints, g) >= TARGET_RATIO
    )
      ? withTints
      : readableOn(color, grounds, TARGET_RATIO);
  }
  const muted = vars['--muted-foreground'];
  if (muted && isHex(muted)) {
    const readableMuted = readableOn(muted, grounds, TARGET_RATIO);
    if (readableMuted !== muted) out['--muted-foreground'] = readableMuted;
  }
  return out;
}
