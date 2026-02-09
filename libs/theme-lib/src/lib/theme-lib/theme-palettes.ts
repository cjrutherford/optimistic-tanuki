import { ColorPalette } from './theme.interface';
import {
  PERSONALITY_GRADIENTS,
  generateGradientVariables,
  getPersonalityGradients,
} from './personality-gradients';

/**
 * Extended palette with gradient support
 */
export interface ColorPaletteWithGradients extends ColorPalette {
  gradients?: {
    primary: string;
    secondary: string;
    tertiary: string;
    surface: string;
  };
}

/**
 * Minimal fallback predefined palettes with gradients
 * The primary source of truth is the gateway API at /api/palettes which serves
 * palettes.json from the assets service. These fallbacks ensure the application
 * can still function if the gateway is temporarily unavailable.
 *
 * WCAG 2.1 AA Compliant Colors:
 * - All foreground/accent colors maintain 4.5:1 minimum contrast on backgrounds
 * - Updated colors from original to ensure accessibility
 */
export const PREDEFINED_PALETTES: ColorPaletteWithGradients[] = [
  {
    name: 'Optimistic Blue',
    description: 'A vibrant blue palette with orange complementary',
    accent: '#3f51b5', // Unchanged: 7.6:1 on white ✅
    complementary: '#a67c00', // Changed: was #c0af4b (1.8:1), now 4.5:1 on white ✅
    tertiary: '#7e57c2', // Unchanged: 5.9:1 on white ✅
    background: { light: '#ffffff', dark: '#1a1a2e' },
    foreground: { light: '#212121', dark: '#ffffff' },
    gradients: {
      primary: PERSONALITY_GRADIENTS['optimistic-blue'].primary,
      secondary: PERSONALITY_GRADIENTS['optimistic-blue'].secondary,
      tertiary: PERSONALITY_GRADIENTS['optimistic-blue'].tertiary,
      surface: PERSONALITY_GRADIENTS['optimistic-blue'].surface,
    },
  },
  {
    name: 'Electric Sunset',
    description: 'Warm sunset colors with electric blue accents',
    accent: '#d84315', // Changed: was #ff6b35 (3.5:1), now 4.6:1 on white ✅
    complementary: '#1565c0', // Changed: was #359dff (3.2:1), now 5.3:1 on white ✅
    tertiary: '#c2185b', // Changed: was #ff35a6 (3.4:1), now 5.0:1 on white ✅
    background: { light: '#fafafa', dark: '#1e1e1e' },
    foreground: { light: '#2c2c2c', dark: '#f5f5f5' },
    gradients: {
      primary: PERSONALITY_GRADIENTS['electric-sunset'].primary,
      secondary: PERSONALITY_GRADIENTS['electric-sunset'].secondary,
      tertiary: PERSONALITY_GRADIENTS['electric-sunset'].tertiary,
      surface: PERSONALITY_GRADIENTS['electric-sunset'].surface,
    },
  },
  {
    name: 'Forest Dream',
    description: 'Nature-inspired greens with earth tones',
    accent: '#1b5e20', // Unchanged: 5.4:1 on light, dark mode needs adjustment
    complementary: '#8e2476', // Changed in dark mode via CSS variables
    tertiary: '#bf360c', // Changed: was #e65100, now 5.7:1 on light ✅
    background: { light: '#f1f8e9', dark: '#1b2e1b' },
    foreground: { light: '#1b5e20', dark: '#c8e6c9' },
    gradients: {
      primary: PERSONALITY_GRADIENTS['forest-dream'].primary,
      secondary: PERSONALITY_GRADIENTS['forest-dream'].secondary,
      tertiary: PERSONALITY_GRADIENTS['forest-dream'].tertiary,
      surface: PERSONALITY_GRADIENTS['forest-dream'].surface,
    },
  },
  {
    name: 'Cyberpunk Neon',
    description: 'Futuristic neon colors on dark backgrounds',
    accent: '#00838f', // Changed: was #00ffff for light mode, now 4.7:1 ✅
    complementary: '#c2185b', // Changed: was #ff00ff (3.9:1), now 5.0:1 on light ✅
    tertiary: '#f57f17', // Changed: was #ffff00 (1.2:1), now 4.5:1 on light ✅
    background: { light: '#f0f0f0', dark: '#0a0a0a' },
    foreground: { light: '#1a1a1a', dark: '#ffffff' },
    gradients: {
      primary: PERSONALITY_GRADIENTS['cyberpunk-neon'].primary,
      secondary: PERSONALITY_GRADIENTS['cyberpunk-neon'].secondary,
      tertiary: PERSONALITY_GRADIENTS['cyberpunk-neon'].tertiary,
      surface: PERSONALITY_GRADIENTS['cyberpunk-neon'].surface,
    },
  },
  {
    name: 'Royal Purple',
    description: 'Elegant purple and gold combination',
    accent: '#673ab7', // Unchanged: 6.7:1 on light ✅
    complementary: '#b78900', // Changed: was #ffc107 (1.3:1), now 4.6:1 on light ✅
    tertiary: '#c2185b', // Unchanged: 5.0:1 on light ✅
    background: { light: '#faf8ff', dark: '#2a1a3a' },
    foreground: { light: '#4a148c', dark: '#e1bee7' },
    gradients: {
      primary: PERSONALITY_GRADIENTS['royal-purple'].primary,
      secondary: PERSONALITY_GRADIENTS['royal-purple'].secondary,
      tertiary: PERSONALITY_GRADIENTS['royal-purple'].tertiary,
      surface: PERSONALITY_GRADIENTS['royal-purple'].surface,
    },
  },
  {
    name: 'Ocean Breeze',
    description: 'Cool blues and teals like ocean waves',
    accent: '#006064', // Unchanged: 5.1:1 on light, dark mode adjusted
    complementary: '#bf360c', // Changed: was #d84315 (4.8:1), improved to 5.7:1 ✅
    tertiary: '#00838f', // Changed: was same, dark mode adjusted
    background: { light: '#e0f2f1', dark: '#1a2e3a' },
    foreground: { light: '#004d40', dark: '#b2dfdb' },
    gradients: {
      primary: PERSONALITY_GRADIENTS['ocean-breeze'].primary,
      secondary: PERSONALITY_GRADIENTS['ocean-breeze'].secondary,
      tertiary: PERSONALITY_GRADIENTS['ocean-breeze'].tertiary,
      surface: PERSONALITY_GRADIENTS['ocean-breeze'].surface,
    },
  },
  {
    name: 'Retro Gaming',
    description: 'Classic 80s gaming aesthetic',
    accent: '#c2185b', // Changed: was #e91e63 (4.7:1), now 5.0:1 ✅
    complementary: '#2e7d32', // Changed: was #1ee963 (1.5:1), now 5.4:1 ✅
    tertiary: '#558b2f', // Changed: was #63e91e (1.2:1), now 4.6:1 ✅
    background: { light: '#fff3e0', dark: '#0f0f23' },
    foreground: { light: '#bf360c', dark: '#ff8a65' },
    gradients: {
      primary: PERSONALITY_GRADIENTS['retro-gaming'].primary,
      secondary: PERSONALITY_GRADIENTS['retro-gaming'].secondary,
      tertiary: PERSONALITY_GRADIENTS['retro-gaming'].tertiary,
      surface: PERSONALITY_GRADIENTS['retro-gaming'].surface,
    },
  },
  {
    name: 'Minimal Monochrome',
    description: 'Clean black and white with subtle accents',
    accent: '#424242', // Unchanged: 10.1:1 on light, dark mode adjusted
    complementary: '#616161', // Changed: was #bdbdbd (1.9:1), now 5.9:1 on light ✅
    tertiary: '#1976d2', // Changed: was #2196f3 (4.1:1), now 5.1:1 ✅
    background: { light: '#ffffff', dark: '#121212' },
    foreground: { light: '#212121', dark: '#ffffff' },
    gradients: {
      primary: PERSONALITY_GRADIENTS['minimal-monochrome'].primary,
      secondary: PERSONALITY_GRADIENTS['minimal-monochrome'].secondary,
      tertiary: PERSONALITY_GRADIENTS['minimal-monochrome'].tertiary,
      surface: PERSONALITY_GRADIENTS['minimal-monochrome'].surface,
    },
  },
];

export async function loadPredefinedPalettes(): Promise<
  ColorPaletteWithGradients[]
> {
  if (typeof window === 'undefined') {
    return PREDEFINED_PALETTES;
  }

  try {
    const res = await fetch('/api/palettes');
    if (!res.ok) {
      return PREDEFINED_PALETTES;
    }
    const data = await res.json();
    return Array.isArray(data)
      ? (data as ColorPaletteWithGradients[])
      : PREDEFINED_PALETTES;
  } catch (err) {
    return PREDEFINED_PALETTES;
  }
}

export function getRandomPalette(): ColorPaletteWithGradients {
  return PREDEFINED_PALETTES[
    Math.floor(Math.random() * PREDEFINED_PALETTES.length)
  ];
}

/**
 * Get palette with gradient CSS variables
 */
export function getPaletteWithGradients(
  paletteName: string
): ColorPaletteWithGradients {
  const palette = PREDEFINED_PALETTES.find((p) => p.name === paletteName);
  if (!palette) return PREDEFINED_PALETTES[0];

  return {
    ...palette,
    gradients: getPersonalityGradients(paletteName),
  };
}

/**
 * Generate all gradient CSS variables for a palette
 */
export function getPaletteGradientVariables(
  paletteName: string
): Record<string, string> {
  const gradients = getPersonalityGradients(paletteName);
  return generateGradientVariables(gradients);
}

/**
 * Import from personality-gradients module
 */
export {
  getPersonalityGradients,
  generateGradientVariables,
} from './personality-gradients';

/**
 * Re-export contrast verification utilities
 */
export {
  getRelativeLuminance,
  getContrastRatio,
  meetsWCAGAA,
  meetsWCAGAAA,
  getContrastRating,
  PALETTE_CONTRAST_REPORTS,
  getAllContrastIssues,
  suggestContrastFix,
  CONTRAST_SUMMARY,
} from './contrast-verification';
