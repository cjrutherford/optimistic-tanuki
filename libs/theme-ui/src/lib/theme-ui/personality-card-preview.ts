/**
 * Helpers for the personality selector: the per-card CSS variables that let a
 * card render in its own personality's look (independent of the applied
 * theme), and the icon each personality is filed under.
 */
import {
  Personality,
  ensureContrast,
  mix,
  getContrastRatio,
  generatePersonalityColors,
  harmonyHueOptions,
} from '@optimistic-tanuki/theme-models';
import {
  generatePageBackgroundPattern,
  resolveExtensionVariables,
  resolveReadableText,
  fillColorsOver,
  generateThemeResponsiveColors,
} from '@optimistic-tanuki/theme-lib';
import type { IconName } from '@optimistic-tanuki/common-ui';

export type PersonalityPreviewMode = 'light' | 'dark';

/** One distinct icon per predefined personality. */
export const PERSONALITY_ICONS: Record<string, IconName> = {
  classic: 'home',
  minimal: 'remove',
  bold: 'flame',
  soft: 'heart',
  professional: 'work',
  playful: 'star',
  elegant: 'verified',
  architect: 'view-quilt',
  'soft-touch': 'bookmark',
  electric: 'route',
  'control-center': 'settings-applications',
  foundation: 'shield',
  risograph: 'image',
  observatory: 'compass',
  ledger: 'book',
  kunsthalle: 'eye',
  canopy: 'trending-up',
  clay: 'extension',
};

export function personalityIcon(personality: Personality): IconName {
  return PERSONALITY_ICONS[personality.id] ?? 'extension';
}

/** Same encode step ThemeService uses for its SVG backgrounds. */
function encodeSvgBackground(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg).replace(
    /'/g,
    '%27'
  )}")`;
}

interface ButtonFill {
  image: string;
  text: string;
  /** Right padding that keeps the label on the primary half of a hard split. */
  padRight: string;
}

/**
 * The button fill with a label colour that reads on it. Sheens and duotone
 * stops are eased toward the primary until black or white passes 4.5:1; a
 * hard split keeps the label on the primary half instead.
 */
function fitButtonFill(base: string, fill: string | undefined): ButtonFill {
  const hex = /#[0-9a-f]{6}\b/gi;
  const pick = (stops: string[]) => {
    const worst = (t: string) =>
      Math.min(...stops.map((c) => getContrastRatio(t, c)));
    const [w, k] = [worst('#ffffff'), worst('#000000')];
    return w >= k
      ? { text: '#ffffff', ratio: w }
      : { text: '#000000', ratio: k };
  };
  let image = fill ?? '';
  let best = { text: '#ffffff', ratio: 0 };
  for (const t of [1, 0.7, 0.5, 0.3, 0.15, 0]) {
    image = (fill ?? '')
      .replace(
        /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/g,
        (_m, r, g, b, a) => `rgba(${r}, ${g}, ${b}, ${Number(a) * t})`
      )
      .replace(hex, (c) =>
        c.toLowerCase() === base.toLowerCase() ? c : mix(c, base, t)
      );
    const own = [...image.matchAll(hex)].map((m) => m[0]);
    best = pick([base, ...own, ...fillColorsOver(image, base)]);
    if (best.ratio >= 4.5) break;
  }
  return { image: fill ? image : 'none', text: best.text, padRight: '8px' };
}

/**
 * CSS custom properties describing how `personality` applies `primaryColor`
 * in `mode`, scoped to one element via `[style]`; nothing is applied globally.
 * Colour comes only from the user's primary; the personality decides how it
 * is used (ground, accent band, surface finish, button fill, type treatment).
 * Runs the same extension resolver ThemeService runs.
 */
export function buildPersonalityPreviewVars(
  personality: Personality,
  mode: PersonalityPreviewMode,
  primaryColor: string
): Record<string, string> {
  const colors = generatePersonalityColors(
    primaryColor,
    personality.colorHarmony.type,
    personality.colorHarmony.saturationBoost,
    personality.colorHarmony.lightnessShift,
    personality.colorHarmony.accentSaturation,
    personality.colorHarmony.accentLightness,
    harmonyHueOptions(personality.colorHarmony)
  );
  const theme = generateThemeResponsiveColors(
    primaryColor,
    personality.colorGeneration,
    mode
  );
  const min = personality.contrast.minimumRatio >= 7 ? 7 : 4.5;
  const foreground = ensureContrast(
    ensureContrast(theme.foreground, theme.surface, min, 'auto'),
    theme.background,
    min,
    'auto'
  );

  const base: Record<string, string> = {
    '--background': theme.background,
    '--surface': theme.surface,
    '--foreground': foreground,
    '--foreground-secondary': theme.textSecondary ?? theme.muted,
    '--muted': theme.muted,
    '--muted-foreground': theme.muted,
    '--border': theme.border,
    '--primary': colors.primary,
    '--secondary': colors.secondary,
    '--tertiary': colors.tertiary,
  };
  const v: Record<string, string> = {
    ...base,
    ...resolveExtensionVariables(
      personality,
      personality,
      primaryColor,
      mode,
      base
    ),
  };
  Object.assign(v, resolveReadableText(v));

  const layer = (...images: (string | undefined)[]) => {
    const list = images.filter((i) => i && i !== 'none');
    return list.length ? list.join(', ') : 'none';
  };
  let pattern = v['--pattern-page'];
  if (!pattern && personality.pageBackground) {
    pattern = encodeSvgBackground(
      generatePageBackgroundPattern(
        primaryColor,
        personality.pageBackground.pattern,
        personality.pageBackground.usePrimaryTint,
        personality.colorGeneration.pageBackgroundOpacity,
        mode
      )
    );
  }

  const pres = personality.presentation;
  const headingFamily =
    v['--heading-family'] ||
    personality.fonts.heading?.family ||
    personality.fonts.body.family;
  const weights = personality.fonts.heading?.weights ?? [600];
  const primary = v['--primary'];
  const button = fitButtonFill(primary, v['--primary-fill']);
  const band = v['--accent-ground'];

  return {
    '--pv-bg': v['--background'],
    '--pv-ground-image': layer(pattern, v['--atmosphere-backdrop']),
    '--pv-pattern-size': v['--pattern-page-size'] || 'auto',
    '--pv-surface': v['--surface'],
    '--pv-surface-image': layer(v['--surface-fill']),
    '--pv-surface-filter': v['--surface-backdrop-filter'] || 'none',
    '--pv-fg': v['--foreground'],
    '--pv-border': v['--border'],
    '--pv-primary': primary,
    '--pv-primary-text': v['--primary-text'] || primary,
    '--pv-primary-fg': button.text,
    '--pv-button-pad-right': button.padRight,
    '--pv-primary-image': layer(button.image),
    '--pv-band': band || 'transparent',
    '--pv-band-fg': band
      ? v['--on-accent-ground'] || v['--foreground']
      : v['--foreground'],
    '--pv-band-image': layer(v['--pattern-accent'], v['--accent-fill']),
    '--pv-band-size': v['--pattern-accent-size'] || 'auto',
    '--pv-band-rule': band ? 'transparent' : primary,
    '--pv-font-heading': headingFamily,
    '--pv-font-body': personality.fonts.body.family,
    '--pv-heading-weight':
      v['--heading-weight'] || String(weights[weights.length - 1] ?? 600),
    '--pv-heading-transform': v['--heading-transform'] || 'none',
    '--pv-heading-tracking': v['--heading-tracking'] || 'normal',
    '--pv-radius': pres?.border.radiusValue ?? '6px',
    '--pv-button-radius':
      pres?.components.button.borderRadius ?? pres?.border.radiusValue ?? '6px',
    '--pv-button-weight': pres?.components.button.fontWeight ?? '600',
    '--pv-button-transform': pres?.components.button.textTransform ?? 'none',
    '--pv-card-radius':
      pres?.components.card.borderRadius ?? pres?.border.radiusValue ?? '8px',
    '--pv-card-shadow':
      pres?.components.card.boxShadow ?? pres?.shadow.value ?? 'none',
    '--pv-border-width': pres?.border.widthValue ?? '1px',
    '--pv-border-style': pres?.border.styleValue ?? 'solid',
  };
}
