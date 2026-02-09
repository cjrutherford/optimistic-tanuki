/**
 * Predefined personality presets for the design system
 * Each personality provides a complete aesthetic configuration
 */

import {
  Personality,
  ColorHarmonyType,
  SpacingScale,
  BorderRadiusStyle,
  ShadowIntensity,
  TypographyStyle,
  AnimationSpeed,
  IconStyle,
  BorderStyle,
} from './personality.interfaces';

/**
 * Classic personality - The original design system aesthetic
 * Clean, balanced, professional with moderate spacing
 */
export const classicPersonality: Personality = {
  id: 'classic',
  name: 'Classic',
  description:
    'The original Optimistic Tanuki aesthetic - balanced, clean, and versatile for any application.',
  version: '1.0.0',

  colorHarmony: {
    type: 'complementary' as ColorHarmonyType,
    saturationBoost: 0,
    lightnessShift: 0,
    accentSaturation: 65,
    accentLightness: 50,
  },

  contrast: {
    minimumRatio: 4.5,
    enhancedRatio: 7,
    backgroundOffset: 0.05,
    autoAdjust: true,
  },

  tokens: {
    spacingScale: 'comfortable' as SpacingScale,
    spacingMultiplier: 1,
    borderRadius: 'soft' as BorderRadiusStyle,
    borderRadiusMultiplier: 1,
    borderStyle: 'thin' as BorderStyle,
    borderWidth: '1px',
    shadowIntensity: 'medium' as ShadowIntensity,
    shadowMultiplier: 1,
    typography: 'clean' as TypographyStyle,
    lineHeight: 1.5,
    letterSpacing: 'normal',
  },

  fonts: {
    body: {
      family:
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      weights: [400, 500, 600, 700],
      display: 'swap',
      preload: false,
    },
    heading: {
      family:
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      weights: [500, 600, 700],
      display: 'swap',
      preload: false,
    },
    mono: {
      family: '"SF Mono", "Monaco", "Inconsolata", "Fira Code", monospace',
      weights: [400, 500],
      display: 'swap',
      preload: false,
    },
  },

  animations: {
    speed: 'normal' as AnimationSpeed,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    duration: {
      instant: '0ms',
      fast: '150ms',
      normal: '300ms',
      slow: '500ms',
    },
    staggerDelay: '50ms',
    prefersReducedMotion: false,
  },

  iconStyle: 'outlined' as IconStyle,

  modes: {
    light: {
      background: {
        base: '#ffffff',
        elevated: '#fafafa',
        overlay: 'rgba(0, 0, 0, 0.5)',
        surface: '#ffffff',
      },
      foreground: {
        primary: '#171717',
        secondary: '#525252',
        muted: '#737373',
        inverted: '#ffffff',
      },
      surfaceOpacity: 1,
      shadowOpacity: 0.1,
      shadowColor: 'rgba(0, 0, 0, 0.1)',
    },
    dark: {
      background: {
        base: '#0a0a0a',
        elevated: '#171717',
        overlay: 'rgba(0, 0, 0, 0.8)',
        surface: '#1f1f1f',
      },
      foreground: {
        primary: '#fafafa',
        secondary: '#a3a3a3',
        muted: '#737373',
        inverted: '#171717',
      },
      surfaceOpacity: 0.9,
      shadowOpacity: 0.5,
      shadowColor: 'rgba(0, 0, 0, 0.5)',
    },
  },

  mobile: {
    spacingMultiplier: 0.875,
    borderRadiusMultiplier: 1,
    shadowReduction: 0.3,
    fontScale: 0.95,
    touchTargetSize: '44px',
  },

  tags: ['versatile', 'balanced', 'professional', 'default'],
  category: 'professional',
  isClassic: true,
};

/**
 * Minimal personality - Clean, spacious, with ample whitespace
 * Best for: Dashboards, professional tools, content-heavy apps
 */
export const minimalPersonality: Personality = {
  id: 'minimal',
  name: 'Minimal',
  description:
    'Clean, spacious design with subtle colors and generous whitespace.',
  version: '1.0.0',

  colorHarmony: {
    type: 'analogous' as ColorHarmonyType,
    saturationBoost: -0.3,
    lightnessShift: 0.1,
    accentSaturation: 35,
    accentLightness: 55,
    analogousSpread: 25,
  },

  contrast: {
    minimumRatio: 7,
    enhancedRatio: 7,
    backgroundOffset: 0.02,
    autoAdjust: true,
  },

  tokens: {
    spacingScale: 'spacious' as SpacingScale,
    spacingMultiplier: 1.25,
    borderRadius: 'sharp' as BorderRadiusStyle,
    borderRadiusMultiplier: 0.75,
    borderStyle: 'hairline' as BorderStyle,
    borderWidth: '0.5px',
    shadowIntensity: 'subtle' as ShadowIntensity,
    shadowMultiplier: 0.6,
    typography: 'clean' as TypographyStyle,
    lineHeight: 1.6,
    letterSpacing: '0.01em',
  },

  fonts: {
    body: {
      family: 'Inter, system-ui, -apple-system, sans-serif',
      weights: [300, 400, 500, 600],
      display: 'swap',
      preload: true,
    },
    heading: {
      family: 'Inter, system-ui, -apple-system, sans-serif',
      weights: [400, 500, 600],
      display: 'swap',
      preload: true,
    },
    mono: {
      family: '"JetBrains Mono", "Fira Code", monospace',
      weights: [400, 500],
      display: 'swap',
      preload: false,
    },
  },

  animations: {
    speed: 'fast' as AnimationSpeed,
    easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
    duration: {
      instant: '0ms',
      fast: '100ms',
      normal: '200ms',
      slow: '350ms',
    },
    staggerDelay: '30ms',
    prefersReducedMotion: true,
  },

  iconStyle: 'outlined' as IconStyle,

  modes: {
    light: {
      background: {
        base: '#fafafa',
        elevated: '#ffffff',
        overlay: 'rgba(0, 0, 0, 0.4)',
        surface: '#ffffff',
      },
      foreground: {
        primary: '#171717',
        secondary: '#404040',
        muted: '#737373',
        inverted: '#ffffff',
      },
      surfaceOpacity: 1,
      shadowOpacity: 0.06,
      shadowColor: 'rgba(0, 0, 0, 0.06)',
    },
    dark: {
      background: {
        base: '#050505',
        elevated: '#0a0a0a',
        overlay: 'rgba(0, 0, 0, 0.8)',
        surface: '#111111',
      },
      foreground: {
        primary: '#fafafa',
        secondary: '#a3a3a3',
        muted: '#525252',
        inverted: '#050505',
      },
      surfaceOpacity: 0.95,
      shadowOpacity: 0.6,
      shadowColor: 'rgba(0, 0, 0, 0.6)',
    },
  },

  mobile: {
    spacingMultiplier: 0.8,
    borderRadiusMultiplier: 0.75,
    shadowReduction: 0.4,
    fontScale: 0.92,
    touchTargetSize: '48px',
  },

  tags: ['clean', 'spacious', 'elegant', 'modern'],
  category: 'professional',
};

/**
 * Bold personality - High contrast, vibrant, makes a statement
 * Best for: Marketing sites, creative portfolios, landing pages
 */
export const boldPersonality: Personality = {
  id: 'bold',
  name: 'Bold',
  description:
    'High contrast, vibrant accents that make a strong visual statement.',
  version: '1.0.0',

  colorHarmony: {
    type: 'complementary' as ColorHarmonyType,
    saturationBoost: 0.4,
    lightnessShift: -0.05,
    accentSaturation: 85,
    accentLightness: 48,
  },

  contrast: {
    minimumRatio: 4.5,
    enhancedRatio: 7,
    backgroundOffset: 0.1,
    autoAdjust: true,
  },

  tokens: {
    spacingScale: 'comfortable' as SpacingScale,
    spacingMultiplier: 1,
    borderRadius: 'soft' as BorderRadiusStyle,
    borderRadiusMultiplier: 1.25,
    borderStyle: 'thick' as BorderStyle,
    borderWidth: '2px',
    shadowIntensity: 'dramatic' as ShadowIntensity,
    shadowMultiplier: 1.5,
    typography: 'friendly' as TypographyStyle,
    lineHeight: 1.4,
    letterSpacing: '-0.01em',
  },

  fonts: {
    body: {
      family: 'Poppins, system-ui, sans-serif',
      weights: [400, 500, 600, 700],
      display: 'swap',
      preload: true,
    },
    heading: {
      family: 'Poppins, system-ui, sans-serif',
      weights: [600, 700, 800],
      display: 'swap',
      preload: true,
    },
    mono: {
      family: '"Fira Code", monospace',
      weights: [400, 500],
      display: 'swap',
      preload: false,
    },
  },

  animations: {
    speed: 'normal' as AnimationSpeed,
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    duration: {
      instant: '0ms',
      fast: '150ms',
      normal: '300ms',
      slow: '600ms',
    },
    staggerDelay: '75ms',
    prefersReducedMotion: false,
  },

  iconStyle: 'filled' as IconStyle,

  modes: {
    light: {
      background: {
        base: '#ffffff',
        elevated: '#fafafa',
        overlay: 'rgba(0, 0, 0, 0.6)',
        surface: '#ffffff',
      },
      foreground: {
        primary: '#0a0a0a',
        secondary: '#404040',
        muted: '#666666',
        inverted: '#ffffff',
      },
      surfaceOpacity: 1,
      shadowOpacity: 0.15,
      shadowColor: 'rgba(0, 0, 0, 0.15)',
    },
    dark: {
      background: {
        base: '#0f0f0f',
        elevated: '#1a1a1a',
        overlay: 'rgba(0, 0, 0, 0.85)',
        surface: '#262626',
      },
      foreground: {
        primary: '#ffffff',
        secondary: '#d4d4d4',
        muted: '#a3a3a3',
        inverted: '#0f0f0f',
      },
      surfaceOpacity: 0.95,
      shadowOpacity: 0.6,
      shadowColor: 'rgba(0, 0, 0, 0.6)',
    },
  },

  mobile: {
    spacingMultiplier: 0.9,
    borderRadiusMultiplier: 1.1,
    shadowReduction: 0.2,
    fontScale: 0.98,
    touchTargetSize: '48px',
  },

  tags: ['vibrant', 'energetic', 'marketing', 'creative'],
  category: 'creative',
};

/**
 * Soft personality - Pastel, gentle, calming aesthetic
 * Best for: Wellness apps, lifestyle, educational content
 */
export const softPersonality: Personality = {
  id: 'soft',
  name: 'Soft',
  description:
    'Gentle pastel tones with smooth transitions and calming aesthetics.',
  version: '1.0.0',

  colorHarmony: {
    type: 'analogous' as ColorHarmonyType,
    saturationBoost: -0.2,
    lightnessShift: 0.15,
    accentSaturation: 45,
    accentLightness: 65,
    analogousSpread: 35,
  },

  contrast: {
    minimumRatio: 4.5,
    enhancedRatio: 7,
    backgroundOffset: 0.08,
    autoAdjust: true,
  },

  tokens: {
    spacingScale: 'airy' as SpacingScale,
    spacingMultiplier: 1.4,
    borderRadius: 'round' as BorderRadiusStyle,
    borderRadiusMultiplier: 1.5,
    borderStyle: 'thin' as BorderStyle,
    borderWidth: '1px',
    shadowIntensity: 'subtle' as ShadowIntensity,
    shadowMultiplier: 0.7,
    typography: 'elegant' as TypographyStyle,
    lineHeight: 1.7,
    letterSpacing: '0.02em',
  },

  fonts: {
    body: {
      family: '"Nunito Sans", system-ui, sans-serif',
      weights: [300, 400, 600],
      display: 'swap',
      preload: true,
    },
    heading: {
      family: 'Quicksand, system-ui, sans-serif',
      weights: [500, 600, 700],
      display: 'swap',
      preload: true,
    },
    mono: {
      family: '"Fira Code", monospace',
      weights: [400],
      display: 'swap',
      preload: false,
    },
  },

  animations: {
    speed: 'slow' as AnimationSpeed,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    duration: {
      instant: '0ms',
      fast: '200ms',
      normal: '400ms',
      slow: '700ms',
    },
    staggerDelay: '100ms',
    prefersReducedMotion: true,
  },

  iconStyle: 'rounded' as IconStyle,

  modes: {
    light: {
      background: {
        base: '#fefdfb',
        elevated: '#ffffff',
        overlay: 'rgba(0, 0, 0, 0.3)',
        surface: '#ffffff',
      },
      foreground: {
        primary: '#1f2937',
        secondary: '#4b5563',
        muted: '#9ca3af',
        inverted: '#ffffff',
      },
      surfaceOpacity: 1,
      shadowOpacity: 0.05,
      shadowColor: 'rgba(0, 0, 0, 0.05)',
    },
    dark: {
      background: {
        base: '#1a1a2e',
        elevated: '#16213e',
        overlay: 'rgba(0, 0, 0, 0.7)',
        surface: '#1f2937',
      },
      foreground: {
        primary: '#f9fafb',
        secondary: '#d1d5db',
        muted: '#9ca3af',
        inverted: '#1a1a2e',
      },
      surfaceOpacity: 0.95,
      shadowOpacity: 0.4,
      shadowColor: 'rgba(0, 0, 0, 0.4)',
    },
  },

  mobile: {
    spacingMultiplier: 0.85,
    borderRadiusMultiplier: 1.3,
    shadowReduction: 0.5,
    fontScale: 0.95,
    touchTargetSize: '44px',
  },

  tags: ['gentle', 'calming', 'wellness', 'friendly'],
  category: 'casual',
};

/**
 * Professional personality - Conservative, trustworthy, enterprise-ready
 * Best for: B2B applications, enterprise software, financial tools
 */
export const professionalPersonality: Personality = {
  id: 'professional',
  name: 'Professional',
  description:
    'Conservative, trustworthy design suitable for enterprise and B2B applications.',
  version: '1.0.0',

  colorHarmony: {
    type: 'split-complementary' as ColorHarmonyType,
    saturationBoost: -0.1,
    lightnessShift: 0,
    accentSaturation: 55,
    accentLightness: 45,
  },

  contrast: {
    minimumRatio: 7,
    enhancedRatio: 7,
    backgroundOffset: 0.03,
    autoAdjust: true,
  },

  tokens: {
    spacingScale: 'comfortable' as SpacingScale,
    spacingMultiplier: 1,
    borderRadius: 'soft' as BorderRadiusStyle,
    borderRadiusMultiplier: 0.875,
    borderStyle: 'thin' as BorderStyle,
    borderWidth: '1px',
    shadowIntensity: 'medium' as ShadowIntensity,
    shadowMultiplier: 0.9,
    typography: 'clean' as TypographyStyle,
    lineHeight: 1.5,
    letterSpacing: 'normal',
  },

  fonts: {
    body: {
      family: '"Source Sans Pro", system-ui, sans-serif',
      weights: [400, 600, 700],
      display: 'swap',
      preload: true,
    },
    heading: {
      family: '"Source Sans Pro", system-ui, sans-serif',
      weights: [600, 700],
      display: 'swap',
      preload: true,
    },
    mono: {
      family: '"Source Code Pro", monospace',
      weights: [400, 600],
      display: 'swap',
      preload: false,
    },
  },

  animations: {
    speed: 'fast' as AnimationSpeed,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    duration: {
      instant: '0ms',
      fast: '100ms',
      normal: '200ms',
      slow: '350ms',
    },
    staggerDelay: '40ms',
    prefersReducedMotion: true,
  },

  iconStyle: 'sharp' as IconStyle,

  modes: {
    light: {
      background: {
        base: '#f8fafc',
        elevated: '#ffffff',
        overlay: 'rgba(15, 23, 42, 0.5)',
        surface: '#ffffff',
      },
      foreground: {
        primary: '#0f172a',
        secondary: '#334155',
        muted: '#64748b',
        inverted: '#ffffff',
      },
      surfaceOpacity: 1,
      shadowOpacity: 0.08,
      shadowColor: 'rgba(15, 23, 42, 0.08)',
    },
    dark: {
      background: {
        base: '#020617',
        elevated: '#0f172a',
        overlay: 'rgba(0, 0, 0, 0.8)',
        surface: '#1e293b',
      },
      foreground: {
        primary: '#f8fafc',
        secondary: '#cbd5e1',
        muted: '#94a3b8',
        inverted: '#020617',
      },
      surfaceOpacity: 0.95,
      shadowOpacity: 0.5,
      shadowColor: 'rgba(0, 0, 0, 0.5)',
    },
  },

  mobile: {
    spacingMultiplier: 0.9,
    borderRadiusMultiplier: 0.875,
    shadowReduction: 0.3,
    fontScale: 0.96,
    touchTargetSize: '48px',
  },

  tags: ['enterprise', 'trustworthy', 'conservative', 'b2b'],
  category: 'professional',
};

/**
 * Playful personality - Energetic, varied, creative
 * Best for: Games, creative tools, youth-oriented apps
 */
export const playfulPersonality: Personality = {
  id: 'playful',
  name: 'Playful',
  description: 'Energetic and fun with varied colors and bouncy animations.',
  version: '1.0.0',

  colorHarmony: {
    type: 'triadic' as ColorHarmonyType,
    saturationBoost: 0.3,
    lightnessShift: 0.05,
    accentSaturation: 80,
    accentLightness: 55,
  },

  contrast: {
    minimumRatio: 4.5,
    enhancedRatio: 7,
    backgroundOffset: 0.12,
    autoAdjust: true,
  },

  tokens: {
    spacingScale: 'spacious' as SpacingScale,
    spacingMultiplier: 1.3,
    borderRadius: 'round' as BorderRadiusStyle,
    borderRadiusMultiplier: 1.75,
    borderStyle: 'thick' as BorderStyle,
    borderWidth: '2px',
    shadowIntensity: 'dramatic' as ShadowIntensity,
    shadowMultiplier: 1.3,
    typography: 'playful' as TypographyStyle,
    lineHeight: 1.5,
    letterSpacing: '0.01em',
  },

  fonts: {
    body: {
      family: '"Comic Neue", "Comic Sans MS", cursive, sans-serif',
      weights: [400, 700],
      display: 'swap',
      preload: true,
    },
    heading: {
      family: '"Fredoka", "Comic Neue", cursive, sans-serif',
      weights: [400, 600, 700],
      display: 'swap',
      preload: true,
    },
    mono: {
      family: '"Fira Code", monospace',
      weights: [400, 600],
      display: 'swap',
      preload: false,
    },
  },

  animations: {
    speed: 'normal' as AnimationSpeed,
    easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    duration: {
      instant: '0ms',
      fast: '150ms',
      normal: '300ms',
      slow: '500ms',
    },
    staggerDelay: '80ms',
    prefersReducedMotion: false,
  },

  iconStyle: 'two-tone' as IconStyle,

  modes: {
    light: {
      background: {
        base: '#fffbeb',
        elevated: '#ffffff',
        overlay: 'rgba(0, 0, 0, 0.4)',
        surface: '#ffffff',
      },
      foreground: {
        primary: '#1c1917',
        secondary: '#44403c',
        muted: '#78716c',
        inverted: '#ffffff',
      },
      surfaceOpacity: 1,
      shadowOpacity: 0.12,
      shadowColor: 'rgba(0, 0, 0, 0.12)',
    },
    dark: {
      background: {
        base: '#1c1917',
        elevated: '#292524',
        overlay: 'rgba(0, 0, 0, 0.75)',
        surface: '#44403c',
      },
      foreground: {
        primary: '#fafaf9',
        secondary: '#d6d3d1',
        muted: '#a8a29e',
        inverted: '#1c1917',
      },
      surfaceOpacity: 0.95,
      shadowOpacity: 0.5,
      shadowColor: 'rgba(0, 0, 0, 0.5)',
    },
  },

  mobile: {
    spacingMultiplier: 1,
    borderRadiusMultiplier: 1.5,
    shadowReduction: 0.15,
    fontScale: 1,
    touchTargetSize: '56px',
  },

  tags: ['fun', 'energetic', 'creative', 'youth'],
  category: 'creative',
};

/**
 * Elegant personality - Sophisticated, refined, luxurious
 * Best for: Luxury brands, portfolios, premium services
 */
export const elegantPersonality: Personality = {
  id: 'elegant',
  name: 'Elegant',
  description:
    'Sophisticated and refined with serif accents and subtle luxury details.',
  version: '1.0.0',

  colorHarmony: {
    type: 'tetradic' as ColorHarmonyType,
    saturationBoost: -0.15,
    lightnessShift: 0.08,
    accentSaturation: 50,
    accentLightness: 45,
  },

  contrast: {
    minimumRatio: 7,
    enhancedRatio: 7,
    backgroundOffset: 0.06,
    autoAdjust: true,
  },

  tokens: {
    spacingScale: 'comfortable' as SpacingScale,
    spacingMultiplier: 1.1,
    borderRadius: 'soft' as BorderRadiusStyle,
    borderRadiusMultiplier: 1,
    borderStyle: 'hairline' as BorderStyle,
    borderWidth: '0.5px',
    shadowIntensity: 'subtle' as ShadowIntensity,
    shadowMultiplier: 0.8,
    typography: 'elegant' as TypographyStyle,
    lineHeight: 1.65,
    letterSpacing: '0.02em',
  },

  fonts: {
    body: {
      family: '"Cormorant Garamond", Georgia, serif',
      weights: [400, 500, 600],
      display: 'swap',
      preload: true,
    },
    heading: {
      family: '"Playfair Display", Georgia, serif',
      weights: [400, 600, 700],
      display: 'swap',
      preload: true,
    },
    mono: {
      family: '"Fira Code", monospace',
      weights: [400, 500],
      display: 'swap',
      preload: false,
    },
    accent: {
      family: '"Great Vibes", cursive',
      weights: [400],
      display: 'swap',
      preload: false,
    },
  },

  animations: {
    speed: 'slow' as AnimationSpeed,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    duration: {
      instant: '0ms',
      fast: '200ms',
      normal: '500ms',
      slow: '800ms',
    },
    staggerDelay: '120ms',
    prefersReducedMotion: false,
  },

  iconStyle: 'outlined' as IconStyle,

  modes: {
    light: {
      background: {
        base: '#fafaf9',
        elevated: '#ffffff',
        overlay: 'rgba(0, 0, 0, 0.4)',
        surface: '#ffffff',
      },
      foreground: {
        primary: '#1c1917',
        secondary: '#44403c',
        muted: '#78716c',
        inverted: '#ffffff',
      },
      surfaceOpacity: 1,
      shadowOpacity: 0.06,
      shadowColor: 'rgba(0, 0, 0, 0.06)',
    },
    dark: {
      background: {
        base: '#0c0a09',
        elevated: '#1c1917',
        overlay: 'rgba(0, 0, 0, 0.85)',
        surface: '#292524',
      },
      foreground: {
        primary: '#fafaf9',
        secondary: '#d6d3d1',
        muted: '#a8a29e',
        inverted: '#0c0a09',
      },
      surfaceOpacity: 0.95,
      shadowOpacity: 0.55,
      shadowColor: 'rgba(0, 0, 0, 0.55)',
    },
  },

  mobile: {
    spacingMultiplier: 0.9,
    borderRadiusMultiplier: 0.9,
    shadowReduction: 0.35,
    fontScale: 0.94,
    touchTargetSize: '44px',
  },

  tags: ['luxury', 'sophisticated', 'premium', 'refined'],
  category: 'professional',
};

/**
 * All predefined personalities
 */
export const PREDEFINED_PERSONALITIES: Personality[] = [
  classicPersonality,
  minimalPersonality,
  boldPersonality,
  softPersonality,
  professionalPersonality,
  playfulPersonality,
  elegantPersonality,
];

/**
 * Get a personality by ID
 */
export function getPersonalityById(id: string): Personality | undefined {
  return PREDEFINED_PERSONALITIES.find((p) => p.id === id);
}

/**
 * Get the default personality (Classic)
 */
export function getDefaultPersonality(): Personality {
  return classicPersonality;
}

/**
 * Get all personality IDs
 */
export function getPersonalityIds(): string[] {
  return PREDEFINED_PERSONALITIES.map((p) => p.id);
}

/**
 * Get personalities by category
 */
export function getPersonalitiesByCategory(
  category: 'professional' | 'creative' | 'casual' | 'technical'
): Personality[] {
  return PREDEFINED_PERSONALITIES.filter((p) => p.category === category);
}

/**
 * Check if a personality ID is valid
 */
export function isValidPersonalityId(id: string): boolean {
  return PREDEFINED_PERSONALITIES.some((p) => p.id === id);
}

/**
 * Get personality preview colors
 * Returns representative colors for the personality selector UI
 */
export function getPersonalityPreviewColors(personality: Personality): {
  light: string[];
  dark: string[];
} {
  return {
    light: [
      personality.modes.light.background.base,
      personality.modes.light.foreground.primary,
    ],
    dark: [
      personality.modes.dark.background.base,
      personality.modes.dark.foreground.primary,
    ],
  };
}
