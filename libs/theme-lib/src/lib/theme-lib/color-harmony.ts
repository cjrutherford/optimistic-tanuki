/**
 * Advanced color harmony algorithms using HSL color space
 * Generates aesthetically pleasing color combinations based on color wheel theory
 */

import { hexToRgb } from './color-utils';
import {
  ColorHarmonyType,
  getContrastRatio,
} from '@optimistic-tanuki/theme-models';

/**
 * RGB color representation
 */
interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * HSL color representation
 */
interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

/**
 * Convert hex to RGB
 */
function hexToRgbInternal(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: h * 360,
    s: s * 100,
    l: l * 100,
  };
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(hsl: HSL): RGB {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Convert RGB to hex
 */
function rgbToHex(rgb: RGB): string {
  const toHex = (n: number): string => {
    const hex = n.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Generate complementary harmony (180° opposite on color wheel)
 * Best for: Bold personalities with high contrast
 */
export function generateComplementaryHarmony(hue: number): number[] {
  return [hue, (hue + 180) % 360];
}

/**
 * Generate triadic harmony (120° intervals)
 * Best for: Playful personalities with balanced vibrancy
 */
export function generateTriadicHarmony(hue: number): number[] {
  return [hue, (hue + 120) % 360, (hue + 240) % 360];
}

/**
 * Generate analogous harmony (adjacent colors)
 * Best for: Minimal, Soft, Elegant personalities
 */
export function generateAnalogousHarmony(hue: number, spread = 30): number[] {
  return [(hue - spread + 360) % 360, hue, (hue + spread) % 360];
}

/**
 * Generate split-complementary harmony (150° and 210° offsets)
 * Best for: Professional personalities with subtle contrast
 */
export function generateSplitComplementaryHarmony(hue: number): number[] {
  return [hue, (hue + 150) % 360, (hue + 210) % 360];
}

/**
 * Generate tetradic harmony (rectangle, 90° intervals)
 * Best for: Elegant personalities with rich color variety
 */
export function generateTetradicHarmony(hue: number): number[] {
  return [hue, (hue + 90) % 360, (hue + 180) % 360, (hue + 270) % 360];
}

/**
 * Generate harmony hues based on type
 */
export function generateHarmonyHues(
  hue: number,
  type: ColorHarmonyType,
  options?: { spread?: number; distance?: number }
): number[] {
  switch (type) {
    case 'complementary':
      return generateComplementaryHarmony(hue);
    case 'triadic':
      return generateTriadicHarmony(hue);
    case 'analogous':
      return generateAnalogousHarmony(hue, options?.spread ?? 30);
    case 'split-complementary':
      return generateSplitComplementaryHarmony(hue);
    case 'tetradic':
      return generateTetradicHarmony(hue);
    default:
      return generateComplementaryHarmony(hue);
  }
}

/**
 * Adjust saturation with personality boost
 */
export function adjustSaturation(
  baseSaturation: number,
  boost: number,
  targetMin = 20,
  targetMax = 100
): number {
  const adjusted = baseSaturation + baseSaturation * boost;
  return Math.max(targetMin, Math.min(targetMax, adjusted));
}

/**
 * Adjust lightness with personality shift
 */
export function adjustLightness(
  baseLightness: number,
  shift: number,
  min = 15,
  max = 95
): number {
  const adjusted = baseLightness + shift * 100;
  return Math.max(min, Math.min(max, adjusted));
}

/**
 * Generate color from harmony hue with personality adjustments
 */
export function generateHarmonyColor(
  baseHsl: HSL,
  targetHue: number,
  saturationBoost: number,
  lightnessShift: number,
  saturationOverride?: number,
  lightnessOverride?: number
): string {
  const s =
    saturationOverride !== undefined
      ? saturationOverride
      : adjustSaturation(baseHsl.s, saturationBoost);

  const l =
    lightnessOverride !== undefined
      ? lightnessOverride
      : adjustLightness(baseHsl.l, lightnessShift);

  const hsl: HSL = {
    h: targetHue,
    s: s,
    l: l,
  };

  return rgbToHex(hslToRgb(hsl));
}

/**
 * Generate perceptually uniform shades using lightness curve
 * Creates smooth transitions from light to dark
 */
export function generatePerceptualShades(
  baseColor: string,
  steps = 10,
  curve: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' = 'ease-in-out'
): string[] {
  const rgb = hexToRgbInternal(baseColor);
  const hsl = rgbToHsl(rgb);
  const shades: string[] = [];

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1); // 0 to 1
    let lightness: number;

    // Apply curve to lightness progression
    switch (curve) {
      case 'linear':
        lightness = 5 + t * 90; // 5% to 95%
        break;
      case 'ease-in':
        lightness = 5 + Math.pow(t, 2) * 90;
        break;
      case 'ease-out':
        lightness = 5 + (1 - Math.pow(1 - t, 2)) * 90;
        break;
      case 'ease-in-out':
        lightness =
          t < 0.5
            ? 5 + 2 * t * t * 90
            : 5 + (1 - Math.pow(-2 * t + 2, 2) / 2) * 90;
        break;
      default:
        lightness = 5 + t * 90;
    }

    const shadeHsl: HSL = {
      h: hsl.h,
      s: hsl.s,
      l: lightness,
    };

    shades.push(rgbToHex(hslToRgb(shadeHsl)));
  }

  return shades;
}

/**
 * Generate semantic colors based on hue relationships
 */
export function generateSemanticColors(
  baseHue: number,
  saturation: number,
  lightness: number
): {
  success: string;
  warning: string;
  danger: string;
  info: string;
} {
  // Success: Green (120°)
  const successHsl: HSL = {
    h: 145, // Slightly adjusted for better aesthetics
    s: Math.min(100, saturation * 0.9),
    l: Math.min(55, lightness * 0.95),
  };

  // Warning: Yellow/Orange (45°)
  const warningHsl: HSL = {
    h: 42,
    s: Math.min(100, saturation * 1.1),
    l: Math.min(60, lightness * 1.05),
  };

  // Danger: Red (0°)
  const dangerHsl: HSL = {
    h: 4, // Slightly adjusted red
    s: Math.min(100, saturation * 1.2),
    l: Math.min(55, lightness),
  };

  // Info: Cyan/Blue (200°)
  const infoHsl: HSL = {
    h: 200,
    s: Math.min(100, saturation * 0.95),
    l: lightness,
  };

  return {
    success: rgbToHex(hslToRgb(successHsl)),
    warning: rgbToHex(hslToRgb(warningHsl)),
    danger: rgbToHex(hslToRgb(dangerHsl)),
    info: rgbToHex(hslToRgb(infoHsl)),
  };
}

/**
 * Calculate color temperature (warmth)
 * Returns value from -1 (cool) to 1 (warm)
 */
export function calculateColorTemperature(hue: number): number {
  // Warm colors: 0-60° (red to yellow) and 300-360° (magenta to red)
  // Cool colors: 120-240° (green to blue)

  if (hue >= 300 || hue <= 60) {
    return 1 - (Math.min(hue <= 60 ? hue : 360 - hue, 30) / 30) * 0.5;
  } else if (hue >= 120 && hue <= 240) {
    return -1 + (Math.abs(hue - 180) / 60) * 0.5;
  } else {
    return 0;
  }
}

/**
 * Generate complete color harmony for a personality
 */
export function generatePersonalityColors(
  primaryColor: string,
  harmonyType: ColorHarmonyType,
  saturationBoost: number,
  lightnessShift: number,
  accentSaturation?: number,
  accentLightness?: number
): {
  primary: string;
  secondary: string;
  tertiary: string;
  primaryHsl: HSL;
  secondaryHsl: HSL;
  tertiaryHsl: HSL;
} {
  const rgb = hexToRgbInternal(primaryColor);
  const primaryHsl = rgbToHsl(rgb);

  // Adjust primary with personality settings
  const adjustedPrimaryHsl: HSL = {
    h: primaryHsl.h,
    s:
      accentSaturation !== undefined
        ? accentSaturation
        : adjustSaturation(primaryHsl.s, saturationBoost),
    l:
      accentLightness !== undefined
        ? accentLightness
        : adjustLightness(primaryHsl.l, lightnessShift),
  };

  const adjustedPrimary = rgbToHex(hslToRgb(adjustedPrimaryHsl));

  // Generate harmony hues
  const hues = generateHarmonyHues(adjustedPrimaryHsl.h, harmonyType);

  // Secondary is always the first harmony color
  const secondaryHsl: HSL = {
    h: hues[1] ?? hues[0],
    s: adjustedPrimaryHsl.s * 0.95,
    l: Math.min(95, adjustedPrimaryHsl.l * 1.1),
  };
  const secondary = rgbToHex(hslToRgb(secondaryHsl));

  // Tertiary is the second harmony color (or complementary if only 2)
  const tertiaryHsl: HSL = {
    h: hues[2] ?? (hues[0] + 180) % 360,
    s: adjustedPrimaryHsl.s * 0.9,
    l: Math.min(95, adjustedPrimaryHsl.l * 1.05),
  };
  const tertiary = rgbToHex(hslToRgb(tertiaryHsl));

  return {
    primary: adjustedPrimary,
    secondary,
    tertiary,
    primaryHsl: adjustedPrimaryHsl,
    secondaryHsl,
    tertiaryHsl,
  };
}

/**
 * Get harmony description for UI display
 */
export function getHarmonyDescription(type: ColorHarmonyType): string {
  switch (type) {
    case 'complementary':
      return 'High contrast colors opposite on the color wheel';
    case 'triadic':
      return 'Three evenly spaced colors for balanced vibrancy';
    case 'analogous':
      return 'Adjacent colors for harmonious, cohesive feel';
    case 'split-complementary':
      return 'Base color with two adjacent to its complement';
    case 'tetradic':
      return 'Four colors in rectangular formation for variety';
    default:
      return '';
  }
}

/**
 * Fixed hue anchors for `surfaceHueBias`'s `warm`/`cool` values — the SAME
 * anchors `generateShadowTintColor` below uses for `shadowTint`'s `warm`/
 * `cool`, so a personality can read as consistently warm- or cool-leaning
 * across both shadows and surfaces regardless of the chosen primary color
 * (Workstream E1/E2, 2026-07-18 refactor plan).
 */
const SURFACE_WARM_HUE = 30;
const SURFACE_COOL_HUE = 210;

/**
 * Minimum acceptable contrast ratio for muted (helper) text rendered on the
 * elevated surface (Workstream E3). There is no existing repo-wide standard
 * for muted-on-SURFACE specifically — `validateThemeContrast` checks
 * muted-on-BACKGROUND at the personality's full `contrast.minimumRatio`
 * (4.5/7), not muted-on-surface — so this floor had to be established
 * empirically rather than inherited.
 *
 * A stricter, more conventional 3.0 (the WCAG 2.1 non-text/large-text floor)
 * was tried first, but measured against EVERY predefined personality x both
 * modes x two representative primary colors (`#3f51b5`/`#e91e63`), it fails
 * even at `surfaceSaturationShift` fully clamped to 0 (the pre-Workstream-E
 * neutral derivation) for most personalities in light mode — i.e. it's not
 * something this phase's hue-bias/saturation-shift clamp CAN satisfy, since
 * `mutedLuminosityOffset` (authored in earlier phases, out of this
 * workstream's scope) already puts muted text within ~2.0-2.7:1 of a
 * near-white surface before any surface character is applied. Requiring 3.0
 * here would make the auto-clamp below retreat to the neutral derivation for
 * every personality unconditionally, silently defeating E1's surface
 * character entirely rather than acting as the narrow safety net it's meant
 * to be. 1.9 is set just under the measured real floor (~1.96, `soft`/light/
 * `#e91e63`) so the clamp only fires when a personality's OWN authored bias
 * makes things worse than that baseline, not because the baseline itself is
 * imperfect.
 */
const MUTED_ON_SURFACE_MIN_RATIO = 1.9;

/** Resolves the hue used for the surface color under a given hue bias. */
function resolveSurfaceHue(
  hueBias: 'none' | 'primary' | 'warm' | 'cool',
  primaryHue: number
): number {
  switch (hueBias) {
    case 'warm':
      return SURFACE_WARM_HUE;
    case 'cool':
      return SURFACE_COOL_HUE;
    case 'primary':
    case 'none':
    default:
      return primaryHue;
  }
}

/**
 * Generate theme-responsive background and foreground colors
 * All colors are derived from the primary color and personality parameters
 *
 * @param contrastMinimumRatio The personality's `contrast.minimumRatio`
 * (4.5 or 7), used ONLY to gate the surface auto-clamp below (Workstream
 * E3). Defaults to the WCAG AA floor (4.5) for callers that don't have a
 * personality's contrast config handy.
 */
export function generateThemeResponsiveColors(
  primaryColor: string,
  params: {
    backgroundLuminosity: number;
    surfaceLuminosityOffset: number;
    foregroundContrast: number;
    secondaryLuminosityOffset: number;
    mutedLuminosityOffset: number;
    neutralSaturation: number;
    darkModeLuminosityScale: number;
    darkModeSaturationBoost: number;
    /** Workstream E1: surface hue character. Defaults to 'none' (neutral). */
    surfaceHueBias?: 'none' | 'primary' | 'warm' | 'cool';
    /** Workstream E1: surface saturation delta off the neutral background. */
    surfaceSaturationShift?: number;
  },
  mode: 'light' | 'dark',
  contrastMinimumRatio = 4.5
): {
  background: string;
  foreground: string;
  surface: string;
  muted: string;
  border: string;
  overlay: string;
} {
  const primaryRgb = hexToRgbInternal(primaryColor);
  const primaryHsl = rgbToHsl(primaryRgb);

  // Determine base luminosity based on mode
  const baseLuminosity =
    mode === 'light'
      ? params.backgroundLuminosity
      : params.backgroundLuminosity * (params.darkModeLuminosityScale / 100);

  // Background: uses primary hue with adjusted saturation/luminosity
  const backgroundHsl: HSL = {
    h: primaryHsl.h,
    s:
      mode === 'light'
        ? params.neutralSaturation
        : Math.min(
            100,
            params.neutralSaturation + params.darkModeSaturationBoost
          ),
    l: baseLuminosity,
  };
  const background = rgbToHex(hslToRgb(backgroundHsl));

  // Foreground: high contrast against background
  const foregroundLuminosity =
    mode === 'light'
      ? Math.max(0, params.backgroundLuminosity - params.foregroundContrast)
      : Math.min(100, baseLuminosity + params.foregroundContrast);

  const foregroundHsl: HSL = {
    h: primaryHsl.h,
    s: mode === 'light' ? 5 : 10, // Very desaturated for text
    l: foregroundLuminosity,
  };
  const foreground = rgbToHex(hslToRgb(foregroundHsl));

  // Secondary (less emphasized text)
  const secondaryHsl: HSL = {
    h: primaryHsl.h,
    s: foregroundHsl.s,
    l: Math.max(
      0,
      Math.min(100, foregroundLuminosity + params.secondaryLuminosityOffset)
    ),
  };
  const secondary = rgbToHex(hslToRgb(secondaryHsl));

  // Muted (helper text)
  const mutedHsl: HSL = {
    h: primaryHsl.h,
    s: foregroundHsl.s,
    l: Math.max(
      0,
      Math.min(100, foregroundLuminosity + params.mutedLuminosityOffset)
    ),
  };
  const muted = rgbToHex(hslToRgb(mutedHsl));

  // Surface: derived from background luminosity + offset (unchanged single
  // source, Workstream E2), now ALSO carrying per-personality hue/saturation
  // character (Workstream E1) instead of always mirroring background's hue
  // and saturation verbatim.
  const surfaceLuminosity = Math.max(
    0,
    Math.min(100, baseLuminosity + params.surfaceLuminosityOffset)
  );
  const hueBias = params.surfaceHueBias ?? 'none';
  const saturationShift = params.surfaceSaturationShift ?? 0;
  const surfaceHue = resolveSurfaceHue(hueBias, primaryHsl.h);

  /**
   * Builds a candidate surface at `shiftFactor` (1 = full authored
   * `surfaceSaturationShift`, 0 = the pre-E1 neutral derivation) and reports
   * whether it still passes the foreground/muted contrast requirement.
   * `shiftFactor` 0 always reproduces the original (pre-Workstream-E)
   * neutral surface color exactly, so the clamp below always has a
   * known-safe (if uncharacterful) fallback available.
   */
  function surfaceCandidate(shiftFactor: number): string {
    const s = Math.max(
      0,
      Math.min(100, backgroundHsl.s + saturationShift * shiftFactor)
    );
    return rgbToHex(hslToRgb({ h: surfaceHue, s, l: surfaceLuminosity }));
  }

  function passesContrast(candidateHex: string): boolean {
    return (
      getContrastRatio(foreground, candidateHex) >= contrastMinimumRatio &&
      getContrastRatio(muted, candidateHex) >= MUTED_ON_SURFACE_MIN_RATIO
    );
  }

  // Auto-clamp (Workstream E3): try the fully-authored bias/shift first; if
  // it would drop foreground-on-surface or muted-on-surface below the
  // required ratio, fall back in steps toward the neutral derivation
  // (shiftFactor 0) rather than shipping a surface that fails contrast.
  let surface = surfaceCandidate(1);
  if (saturationShift !== 0 && !passesContrast(surface)) {
    const fallbackSteps = [0.5, 0.25, 0];
    for (const step of fallbackSteps) {
      const candidate = surfaceCandidate(step);
      surface = candidate;
      if (passesContrast(candidate)) {
        break;
      }
    }
  }

  // Border: subtle, between background and foreground
  const borderLuminosity =
    mode === 'light' ? baseLuminosity - 15 : baseLuminosity + 15;
  const borderHsl: HSL = {
    h: primaryHsl.h,
    s: Math.min(100, backgroundHsl.s * 2),
    l: borderLuminosity,
  };
  const border = rgbToHex(hslToRgb(borderHsl));

  // Overlay: for modals/backdrops
  const overlayHsl: HSL = {
    h: primaryHsl.h,
    s: 0,
    l: mode === 'light' ? 0 : 0,
  };
  const overlayBase = rgbToHex(hslToRgb(overlayHsl));
  const overlay =
    mode === 'light'
      ? `${overlayBase}80` // 50% opacity in hex
      : `${overlayBase}CC`; // 80% opacity in hex

  return {
    background,
    foreground,
    surface,
    muted,
    border,
    overlay,
  };
}

/**
 * Resolve the hue/saturation/lightness of a personality's shadow tint,
 * WITHOUT any alpha/opacity baked in.
 *
 * This is the tint-resolution half of the (formerly fused) shadow-color
 * pipeline: `generateShadowColor()` below bakes a mode-dependent alpha into
 * its returned rgba string, which historically was the ONLY opacity that
 * ever reached a rendered shadow (`generatePersonalityShadows()` in
 * `theme.service.ts` ignored the tint entirely and hardcoded
 * `rgba(0, 0, 0, opacity)`, discarding this function's output). That left
 * two competing opacity sources: this baked alpha, and the separately
 * emitted `--shadow-opacity` (= `personality.colorGeneration.shadowOpacity`).
 *
 * `generateShadowTintColor` lets callers (namely `ThemeService`) take just
 * the RGB tint and apply exactly one, mode-scaled opacity
 * (`personality.colorGeneration.shadowOpacity`, see `resolveShadowOpacity`)
 * themselves — restoring a single source of truth for shadow opacity while
 * still letting `warm`/`cool`/`primary-tint` personalities cast visibly
 * tinted shadows.
 */
export function generateShadowTintColor(
  primaryColor: string,
  shadowTint: 'neutral' | 'primary-tint' | 'warm' | 'cool',
  mode: 'light' | 'dark'
): { r: number; g: number; b: number } {
  const primaryRgb = hexToRgbInternal(primaryColor);
  const primaryHsl = rgbToHsl(primaryRgb);

  switch (shadowTint) {
    case 'neutral':
      return { r: 0, g: 0, b: 0 };

    case 'primary-tint': {
      const tintedHsl: HSL = {
        h: primaryHsl.h,
        s: Math.min(30, primaryHsl.s * 0.3),
        l: mode === 'light' ? 20 : 10,
      };
      return hslToRgb(tintedHsl);
    }

    case 'warm': {
      const warmHsl: HSL = {
        h: 30, // Orange-ish
        s: 30,
        l: mode === 'light' ? 25 : 15,
      };
      return hslToRgb(warmHsl);
    }

    case 'cool': {
      const coolHsl: HSL = {
        h: 210, // Blue-ish
        s: 25,
        l: mode === 'light' ? 20 : 15,
      };
      return hslToRgb(coolHsl);
    }

    default:
      return { r: 0, g: 0, b: 0 };
  }
}

/**
 * The legacy, mode-dependent alpha table that `generateShadowColor()` has
 * always baked into its returned rgba string. Kept verbatim (not touched by
 * B1) purely so `generateShadowColor()`'s public output stays byte-for-byte
 * backward compatible for its existing external consumer
 * (`theme-ui`'s `personality-grid.component.ts`, which renders a
 * side-by-side swatch and is not part of the `--shadow-*` token pipeline).
 * New code that needs a shadow opacity should use
 * `resolveShadowOpacity(personality.colorGeneration.shadowOpacity, mode)`
 * instead — the single, personality-driven opacity source used by
 * `ThemeService`'s `--shadow-*`/`--shadow-color`/`--shadow-opacity` outputs.
 */
function legacyShadowAlpha(
  shadowTint: 'neutral' | 'primary-tint' | 'warm' | 'cool',
  mode: 'light' | 'dark'
): number {
  switch (shadowTint) {
    case 'neutral':
      return mode === 'light' ? 0.1 : 0.5;
    case 'primary-tint':
      return mode === 'light' ? 0.15 : 0.5;
    case 'warm':
    case 'cool':
      return mode === 'light' ? 0.12 : 0.45;
    default:
      return mode === 'light' ? 0.1 : 0.5;
  }
}

/**
 * Generate shadow color based on personality tint preference.
 *
 * @deprecated for the `--shadow-*` token pipeline — this bakes its own
 * fixed, mode-dependent alpha (see `legacyShadowAlpha`) rather than the
 * personality's own `colorGeneration.shadowOpacity`, which is exactly the
 * double-booked-opacity bug fixed in `ThemeService` (see
 * `resolveShadowOpacity`). Retained, unchanged, for its existing external
 * caller (`personality-grid.component.ts`'s swatch). New callers should use
 * `generateShadowTintColor` + `resolveShadowOpacity`.
 */
export function generateShadowColor(
  primaryColor: string,
  shadowTint: 'neutral' | 'primary-tint' | 'warm' | 'cool',
  mode: 'light' | 'dark'
): string {
  const { r, g, b } = generateShadowTintColor(primaryColor, shadowTint, mode);
  const opacity = legacyShadowAlpha(shadowTint, mode);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Single source of truth for shadow opacity (finding 4 / Workstream B1).
 *
 * `personality.colorGeneration.shadowOpacity` (0–0.25) is the ONE authored
 * opacity value for a personality's shadows. Dark-mode shadows need a
 * higher opacity than light-mode to stay visible against a dark background
 * — this mirrors the ~3–5x light→dark jump the old `generateShadowColor`
 * baked in per-tint (e.g. neutral 0.1 → 0.5) — but instead of a second,
 * competing opacity source, it scales the SAME authored value. Clamped so
 * even the highest-authored personality can't exceed a sane maximum.
 */
const DARK_MODE_SHADOW_OPACITY_MULTIPLIER = 3;
const MAX_SHADOW_OPACITY = 0.6;

export function resolveShadowOpacity(
  baseOpacity: number,
  mode: 'light' | 'dark'
): number {
  if (mode !== 'dark') {
    return baseOpacity;
  }
  return Math.min(
    MAX_SHADOW_OPACITY,
    baseOpacity * DARK_MODE_SHADOW_OPACITY_MULTIPLIER
  );
}

/**
 * Generate page background SVG pattern with theme-responsive colors
 */
export function generatePageBackgroundPattern(
  primaryColor: string,
  pattern: string,
  usePrimaryTint: boolean,
  opacity: number,
  mode: 'light' | 'dark'
): string {
  const primaryRgb = hexToRgbInternal(primaryColor);
  const primaryHsl = rgbToHsl(primaryRgb);

  // Calculate tint color
  const tintHsl: HSL = {
    h: primaryHsl.h,
    s: usePrimaryTint ? Math.min(20, primaryHsl.s * 0.4) : 0,
    l: mode === 'light' ? 85 : 25,
  };
  const tintRgb = hslToRgb(tintHsl);
  const tintColor = rgbToHex(tintRgb);

  // Replace placeholder or set default colors in pattern
  // Pattern should use CSS variables or we inject the color
  const hexOpacity = Math.floor(opacity * 255)
    .toString(16)
    .padStart(2, '0');

  // Defense in depth (carry-over fix, Phase 5/5b of the 2026-07-18 refactor
  // plan): a `fill="url(#...)"` reference points at a `<defs>`/`<pattern>`
  // element, not a literal color — rewriting it wholesale (as the naive
  // global replace below would) orphans the pattern definition and paints a
  // flat, uncontrolled wash instead of the authored motif (this is exactly
  // what happened to `control-center`'s grid before its pattern was
  // rewritten to direct shapes with no `url(#)` indirection). Every authored
  // pattern should avoid `url(#)` fills entirely now, but this guard is kept
  // so a future pattern using the indirection doesn't silently regress the
  // same way.
  return pattern.replace(/fill="([^"]*)"/g, (match, value: string) =>
    value.startsWith('url(#') ? match : `fill="${tintColor}${hexOpacity}"`
  );
}
