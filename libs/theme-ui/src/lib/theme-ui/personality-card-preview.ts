/**
 * Helpers for the personality selector: the per-card CSS variables that let a
 * card render in its own personality's look (independent of the applied
 * theme), and the icon each personality is filed under.
 */
import {
  Personality,
  ensureContrast,
  generatePersonalityColors,
  getSuggestedTextColor,
  harmonyHueOptions,
} from '@optimistic-tanuki/theme-models';
import {
  generatePageBackgroundPattern,
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

/**
 * CSS custom properties describing how `personality` looks in `mode` with
 * `primaryColor`, scoped to one element via `[style]`; nothing is applied
 * globally.
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
  // Text sits on both the ground and the surface, so hold it to both.
  const min = personality.contrast.minimumRatio >= 7 ? 7 : 4.5;
  const onSurface = ensureContrast(
    theme.foreground,
    theme.surface,
    min,
    'auto'
  );
  const foreground = ensureContrast(onSurface, theme.background, min, 'auto');

  let pattern = 'none';
  if (personality.pageBackground) {
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
  const heading =
    personality.fonts.heading?.family ?? personality.fonts.body.family;
  const weights = personality.fonts.heading?.weights ?? [600];

  return {
    '--pv-bg': theme.background,
    '--pv-surface': theme.surface,
    '--pv-fg': foreground,
    '--pv-border': theme.border,
    '--pv-primary': colors.primary,
    '--pv-secondary': colors.secondary,
    '--pv-tertiary': colors.tertiary,
    '--pv-primary-fg': getSuggestedTextColor(colors.primary).color,
    '--pv-pattern': pattern,
    '--pv-font-heading': heading,
    '--pv-font-body': personality.fonts.body.family,
    '--pv-heading-weight': String(weights[weights.length - 1] ?? 600),
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
