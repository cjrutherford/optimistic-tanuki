/**
 * Advanced color harmony algorithms using HSL color space
 * Generates aesthetically pleasing color combinations based on color wheel theory
 */

import { hexToRgb } from './color-utils';
import { ColorHarmonyType } from './personality.interfaces';

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
export function generateAnalogousHarmony(
  hue: number,
  spread: number = 30
): number[] {
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
  targetMin: number = 20,
  targetMax: number = 100
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
  min: number = 15,
  max: number = 95
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
  steps: number = 10,
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
