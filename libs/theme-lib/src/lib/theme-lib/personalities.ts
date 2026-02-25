/**
 * Predefined personality presets for the design system
 * Each personality provides a complete aesthetic configuration
 *
 * CONSOLIDATED: 8 distinct personalities (reduced from 12)
 * - Classic: Swiss Design (geometric, balanced)
 * - Minimal: Japanese Zen (extreme whitespace, hairline)
 * - Editorial: Art Deco/Magazine (serif luxury)
 * - Bold: Memphis Design (thick borders, vibrant)
 * - Playful: Kawaii/Cute (pill shapes, bouncy)
 * - Cyber: Terminal/Cyberpunk (monospace, neon)
 * - Industrial: Brutalist (exposed structure, sharp)
 * - Organic: Natural/Scandinavian (warm, soft, nature)
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
} from './personality.interface';

/**
 * 1. CLASSIC - Swiss Design System
 * Geometric clarity, grid-based, neutral
 * Like: Swiss International Style, Braun design
 */
export const classicPersonality: Personality = {
  id: 'classic',
  name: 'Classic',
  description:
    'Swiss Design precision - geometric grids, neutral tones, mathematical clarity.',
  version: '2.0.0',

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
      family: '"Inter", "Helvetica Neue", system-ui, sans-serif',
      weights: [400, 500, 600, 700],
      display: 'swap',
      preload: true,
    },
    heading: {
      family: '"Inter", "Helvetica Neue", system-ui, sans-serif',
      weights: [500, 600, 700, 800],
      display: 'swap',
      preload: true,
    },
    mono: {
      family: '"JetBrains Mono", "SF Mono", "Fira Code", monospace',
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

  colorGeneration: {
    backgroundLuminosity: 100,
    surfaceLuminosityOffset: -2,
    foregroundContrast: 92,
    secondaryLuminosityOffset: 25,
    mutedLuminosityOffset: 40,
    neutralSaturation: 0,
    darkModeLuminosityScale: 6,
    darkModeSaturationBoost: 5,
    shadowTint: 'neutral',
    shadowOpacity: 0.1,
    pageBackgroundOpacity: 0.1,
  },

  pageBackground: {
    pattern: `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect fill="none" width="8" height="8"/><circle cx="4" cy="4" r="1" fill="PLACEHOLDER" opacity="OPACITY"/></svg>`,
    usePrimaryTint: false,
  },

  mobile: {
    spacingMultiplier: 0.875,
    borderRadiusMultiplier: 1,
    shadowReduction: 0.3,
    fontScale: 0.95,
    touchTargetSize: '44px',
  },

  tags: ['versatile', 'balanced', 'professional', 'swiss', 'geometric'],
  category: 'professional',
  isClassic: true,
};

/**
 * 2. MINIMAL - Japanese Zen Aesthetic
 * Extreme whitespace, hairline precision, meditative calm
 * Like: MUJI, Apple, Japanese gardens
 */
export const minimalPersonality: Personality = {
  id: 'minimal',
  name: 'Minimal',
  description:
    'Zen-inspired emptiness - maximum whitespace, hairline borders, meditative clarity.',
  version: '2.0.0',

  colorHarmony: {
    type: 'analogous' as ColorHarmonyType,
    saturationBoost: -0.4,
    lightnessShift: 0.15,
    accentSaturation: 25,
    accentLightness: 60,
    analogousSpread: 20,
  },

  contrast: {
    minimumRatio: 7,
    enhancedRatio: 7,
    backgroundOffset: 0.02,
    autoAdjust: true,
  },

  tokens: {
    spacingScale: 'airy' as SpacingScale,
    spacingMultiplier: 1.5,
    borderRadius: 'sharp' as BorderRadiusStyle,
    borderRadiusMultiplier: 0.6,
    borderStyle: 'hairline' as BorderStyle,
    borderWidth: '0.5px',
    shadowIntensity: 'none' as ShadowIntensity,
    shadowMultiplier: 0,
    typography: 'clean' as TypographyStyle,
    lineHeight: 1.7,
    letterSpacing: '0.03em',
  },

  fonts: {
    body: {
      family: '"Sora", "Inter", system-ui, sans-serif',
      weights: [300, 400, 500],
      display: 'swap',
      preload: true,
    },
    heading: {
      family: '"Sora", "Inter", system-ui, sans-serif',
      weights: [300, 400, 500],
      display: 'swap',
      preload: true,
    },
    mono: {
      family: '"IBM Plex Mono", "Fira Code", monospace',
      weights: [400, 500],
      display: 'swap',
      preload: false,
    },
  },

  animations: {
    speed: 'slow' as AnimationSpeed,
    easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
    duration: {
      instant: '0ms',
      fast: '200ms',
      normal: '400ms',
      slow: '800ms',
    },
    staggerDelay: '100ms',
    prefersReducedMotion: true,
  },

  iconStyle: 'outlined' as IconStyle,

  colorGeneration: {
    backgroundLuminosity: 98,
    surfaceLuminosityOffset: -2,
    foregroundContrast: 94,
    secondaryLuminosityOffset: 25,
    mutedLuminosityOffset: 40,
    neutralSaturation: 5,
    darkModeLuminosityScale: 5,
    darkModeSaturationBoost: 5,
    shadowTint: 'neutral',
    shadowOpacity: 0,
    pageBackgroundOpacity: 0.02,
  },

  pageBackground: {
    pattern: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect fill="none" width="60" height="60"/><circle cx="30" cy="30" r="0.5" fill="PLACEHOLDER" opacity="OPACITY"/></svg>`,
    usePrimaryTint: false,
  },

  mobile: {
    spacingMultiplier: 1.1,
    borderRadiusMultiplier: 0.6,
    shadowReduction: 1,
    fontScale: 0.92,
    touchTargetSize: '48px',
  },

  tags: ['zen', 'japanese', 'whitespace', 'meditative', 'clean'],
  category: 'professional',
};

/**
 * 3. EDITORIAL - Art Deco Magazine
 * Serif elegance, luxury, refined details
 * Like: The New Yorker, high-end fashion magazines
 */
export const editorialPersonality: Personality = {
  id: 'editorial',
  name: 'Editorial',
  description:
    'Magazine-quality elegance - serif typography, refined details, luxurious spacing.',
  version: '2.0.0',

  colorHarmony: {
    type: 'tetradic' as ColorHarmonyType,
    saturationBoost: -0.1,
    lightnessShift: 0.05,
    accentSaturation: 55,
    accentLightness: 48,
  },

  contrast: {
    minimumRatio: 7,
    enhancedRatio: 7,
    backgroundOffset: 0.06,
    autoAdjust: true,
  },

  tokens: {
    spacingScale: 'comfortable' as SpacingScale,
    spacingMultiplier: 1.15,
    borderRadius: 'soft' as BorderRadiusStyle,
    borderRadiusMultiplier: 1.1,
    borderStyle: 'hairline' as BorderStyle,
    borderWidth: '0.5px',
    shadowIntensity: 'subtle' as ShadowIntensity,
    shadowMultiplier: 0.7,
    typography: 'elegant' as TypographyStyle,
    lineHeight: 1.6,
    letterSpacing: '0.02em',
  },

  fonts: {
    body: {
      family: '"Crimson Pro", "Georgia", "Times New Roman", serif',
      weights: [400, 500, 600],
      display: 'swap',
      preload: true,
    },
    heading: {
      family: '"Playfair Display", "Georgia", serif',
      weights: [600, 700, 800, 900],
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

  colorGeneration: {
    backgroundLuminosity: 98,
    surfaceLuminosityOffset: -2,
    foregroundContrast: 88,
    secondaryLuminosityOffset: 25,
    mutedLuminosityOffset: 40,
    neutralSaturation: 8,
    darkModeLuminosityScale: 6,
    darkModeSaturationBoost: 5,
    shadowTint: 'warm',
    shadowOpacity: 0.06,
    pageBackgroundOpacity: 0.05,
  },

  pageBackground: {
    pattern: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect fill="none" width="60" height="60"/><path d="M0 30 L60 30 M30 0 L30 60" stroke="PLACEHOLDER" stroke-width="0.5" opacity="OPACITY"/><circle cx="30" cy="30" r="2" fill="PLACEHOLDER" opacity="OPACITY"/></svg>`,
    usePrimaryTint: false,
  },

  mobile: {
    spacingMultiplier: 1,
    borderRadiusMultiplier: 1,
    shadowReduction: 0.4,
    fontScale: 0.94,
    touchTargetSize: '44px',
  },

  tags: ['luxury', 'serif', 'magazine', 'refined', 'elegant'],
  category: 'professional',
};

/**
 * 4. BOLD - Memphis Design Revival
 * Thick strokes, vibrant contrasts, geometric chaos
 * Like: Memphis Group, 80s postmodern, MTV
 */
export const boldPersonality: Personality = {
  id: 'bold',
  name: 'Bold',
  description:
    'Memphis-inspired energy - thick borders, vibrant contrasts, geometric confidence.',
  version: '2.0.0',

  colorHarmony: {
    type: 'complementary' as ColorHarmonyType,
    saturationBoost: 0.35,
    lightnessShift: -0.05,
    accentSaturation: 90,
    accentLightness: 52,
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
    borderRadiusMultiplier: 1.3,
    borderStyle: 'thick' as BorderStyle,
    borderWidth: '3px',
    shadowIntensity: 'dramatic' as ShadowIntensity,
    shadowMultiplier: 1.5,
    typography: 'friendly' as TypographyStyle,
    lineHeight: 1.4,
    letterSpacing: '-0.01em',
  },

  fonts: {
    body: {
      family: '"Space Grotesk", "Poppins", system-ui, sans-serif',
      weights: [400, 500, 600, 700],
      display: 'swap',
      preload: true,
    },
    heading: {
      family: '"Space Grotesk", "Poppins", system-ui, sans-serif',
      weights: [700, 800],
      display: 'swap',
      preload: true,
    },
    mono: {
      family: '"Space Mono", "Fira Code", monospace',
      weights: [400, 700],
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

  colorGeneration: {
    backgroundLuminosity: 98,
    surfaceLuminosityOffset: -2,
    foregroundContrast: 90,
    secondaryLuminosityOffset: 25,
    mutedLuminosityOffset: 40,
    neutralSaturation: 15,
    darkModeLuminosityScale: 6,
    darkModeSaturationBoost: 5,
    shadowTint: 'primary-tint',
    shadowOpacity: 0.15,
    pageBackgroundOpacity: 0.15,
  },

  pageBackground: {
    pattern: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect fill="none" width="40" height="40"/><circle cx="20" cy="20" r="4" fill="none" stroke="PLACEHOLDER" stroke-width="2" opacity="OPACITY"/><circle cx="20" cy="20" r="12" fill="none" stroke="PLACEHOLDER" stroke-width="1" opacity="OPACITY"/></svg>`,
    usePrimaryTint: true,
  },

  mobile: {
    spacingMultiplier: 0.9,
    borderRadiusMultiplier: 1.1,
    shadowReduction: 0.2,
    fontScale: 0.98,
    touchTargetSize: '48px',
  },

  tags: ['memphis', 'vibrant', 'geometric', 'thick', 'energetic'],
  category: 'creative',
};

/**
 * 5. PLAYFUL - Kawaii/Cute Aesthetic
 * Pill shapes, bouncy animations, friendly warmth
 * Like: Nintendo, Duolingo, Notion
 */
export const playfulPersonality: Personality = {
  id: 'playful',
  name: 'Playful',
  description:
    'Friendly and approachable - pill shapes, bouncy animations, delightful details.',
  version: '2.0.0',

  colorHarmony: {
    type: 'triadic' as ColorHarmonyType,
    saturationBoost: 0.2,
    lightnessShift: 0.08,
    accentSaturation: 75,
    accentLightness: 58,
  },

  contrast: {
    minimumRatio: 4.5,
    enhancedRatio: 7,
    backgroundOffset: 0.08,
    autoAdjust: true,
  },

  tokens: {
    spacingScale: 'spacious' as SpacingScale,
    spacingMultiplier: 1.2,
    borderRadius: 'pill' as BorderRadiusStyle,
    borderRadiusMultiplier: 2,
    borderStyle: 'thick' as BorderStyle,
    borderWidth: '2px',
    shadowIntensity: 'medium' as ShadowIntensity,
    shadowMultiplier: 1,
    typography: 'playful' as TypographyStyle,
    lineHeight: 1.55,
    letterSpacing: '0.01em',
  },

  fonts: {
    body: {
      family: '"Quicksand", "Nunito", system-ui, sans-serif',
      weights: [400, 500, 600, 700],
      display: 'swap',
      preload: true,
    },
    heading: {
      family: '"Fredoka", "Quicksand", system-ui, sans-serif',
      weights: [500, 600, 700],
      display: 'swap',
      preload: true,
    },
    mono: {
      family: '"Comic Code", "Fira Code", monospace',
      weights: [400, 500],
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

  iconStyle: 'rounded' as IconStyle,

  colorGeneration: {
    backgroundLuminosity: 99,
    surfaceLuminosityOffset: -2,
    foregroundContrast: 88,
    secondaryLuminosityOffset: 25,
    mutedLuminosityOffset: 40,
    neutralSaturation: 12,
    darkModeLuminosityScale: 6,
    darkModeSaturationBoost: 5,
    shadowTint: 'primary-tint',
    shadowOpacity: 0.08,
    pageBackgroundOpacity: 0.08,
  },

  pageBackground: {
    pattern: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect fill="none" width="24" height="24"/><circle cx="12" cy="12" r="3" fill="PLACEHOLDER" opacity="OPACITY"/></svg>`,
    usePrimaryTint: true,
  },

  mobile: {
    spacingMultiplier: 1.1,
    borderRadiusMultiplier: 1.8,
    shadowReduction: 0.2,
    fontScale: 1,
    touchTargetSize: '56px',
  },

  tags: ['kawaii', 'friendly', 'pill', 'rounded', 'bouncy'],
  category: 'creative',
};

/**
 * 6. CYBER - Terminal/Cyberpunk Aesthetic
 * Monospace, neon glows, dark tech atmosphere
 * Like: CRT terminals, cyberpunk games, Matrix
 */
export const cyberPersonality: Personality = {
  id: 'cyber',
  name: 'Cyber',
  description:
    'Terminal aesthetic - monospace typography, neon accents, tech atmosphere.',
  version: '2.0.0',

  colorHarmony: {
    type: 'analogous' as ColorHarmonyType,
    saturationBoost: 0.4,
    lightnessShift: 0.1,
    accentSaturation: 85,
    accentLightness: 55,
    analogousSpread: 30,
  },

  contrast: {
    minimumRatio: 7,
    enhancedRatio: 7,
    backgroundOffset: 0.15,
    autoAdjust: true,
  },

  tokens: {
    spacingScale: 'compact' as SpacingScale,
    spacingMultiplier: 0.9,
    borderRadius: 'sharp' as BorderRadiusStyle,
    borderRadiusMultiplier: 0.5,
    borderStyle: 'thin' as BorderStyle,
    borderWidth: '1px',
    shadowIntensity: 'dramatic' as ShadowIntensity,
    shadowMultiplier: 1.3,
    typography: 'modern' as TypographyStyle,
    lineHeight: 1.45,
    letterSpacing: '0.03em',
  },

  fonts: {
    body: {
      family: '"JetBrains Mono", "IBM Plex Mono", monospace',
      weights: [400, 500, 600],
      display: 'swap',
      preload: true,
    },
    heading: {
      family: '"JetBrains Mono", "IBM Plex Mono", monospace',
      weights: [700, 800],
      display: 'swap',
      preload: true,
    },
    mono: {
      family: '"JetBrains Mono", "Fira Code", monospace',
      weights: [400, 500, 600],
      display: 'swap',
      preload: true,
    },
  },

  animations: {
    speed: 'fast' as AnimationSpeed,
    easing: 'steps(4, end)',
    duration: {
      instant: '0ms',
      fast: '50ms',
      normal: '100ms',
      slow: '200ms',
    },
    staggerDelay: '30ms',
    prefersReducedMotion: false,
  },

  iconStyle: 'sharp' as IconStyle,

  colorGeneration: {
    backgroundLuminosity: 98,
    surfaceLuminosityOffset: -2,
    foregroundContrast: 92,
    secondaryLuminosityOffset: 25,
    mutedLuminosityOffset: 40,
    neutralSaturation: 0,
    darkModeLuminosityScale: 5,
    darkModeSaturationBoost: 5,
    shadowTint: 'cool',
    shadowOpacity: 0.2,
    pageBackgroundOpacity: 0.2,
  },

  pageBackground: {
    pattern: `<svg xmlns="http://www.w3.org/2000/svg" width="2" height="4"><rect width="2" height="2" fill="PLACEHOLDER" opacity="OPACITY"/></svg>`,
    usePrimaryTint: false,
  },

  mobile: {
    spacingMultiplier: 0.85,
    borderRadiusMultiplier: 0.5,
    shadowReduction: 0.1,
    fontScale: 0.9,
    touchTargetSize: '44px',
  },

  tags: ['terminal', 'monospace', 'neon', 'matrix', 'cyberpunk'],
  category: 'technical',
};

/**
 * 7. INDUSTRIAL - Brutalist Architecture
 * Exposed structure, raw materials, functional honesty
 * Like: Brutalist buildings, blueprints, construction
 */
export const industrialPersonality: Personality = {
  id: 'industrial',
  name: 'Industrial',
  description:
    'Brutalist honesty - exposed structure, raw edges, functional power.',
  version: '2.0.0',

  colorHarmony: {
    type: 'split-complementary' as ColorHarmonyType,
    saturationBoost: 0.1,
    lightnessShift: -0.1,
    accentSaturation: 70,
    accentLightness: 45,
  },

  contrast: {
    minimumRatio: 4.5,
    enhancedRatio: 7,
    backgroundOffset: 0.1,
    autoAdjust: true,
  },

  tokens: {
    spacingScale: 'comfortable' as SpacingScale,
    spacingMultiplier: 0.95,
    borderRadius: 'sharp' as BorderRadiusStyle,
    borderRadiusMultiplier: 0.4,
    borderStyle: 'thick' as BorderStyle,
    borderWidth: '3px',
    shadowIntensity: 'dramatic' as ShadowIntensity,
    shadowMultiplier: 1.2,
    typography: 'modern' as TypographyStyle,
    lineHeight: 1.4,
    letterSpacing: '0.05em',
  },

  fonts: {
    body: {
      family: '"Archivo", "Oswald", system-ui, sans-serif',
      weights: [400, 500, 600, 700],
      display: 'swap',
      preload: true,
    },
    heading: {
      family: '"Oswald", "Archivo Black", sans-serif',
      weights: [500, 600, 700],
      display: 'swap',
      preload: true,
    },
    mono: {
      family: '"IBM Plex Mono", "Courier New", monospace',
      weights: [400, 500],
      display: 'swap',
      preload: true,
    },
  },

  animations: {
    speed: 'fast' as AnimationSpeed,
    easing: 'steps(2, end)',
    duration: {
      instant: '0ms',
      fast: '50ms',
      normal: '100ms',
      slow: '200ms',
    },
    staggerDelay: '20ms',
    prefersReducedMotion: false,
  },

  iconStyle: 'sharp' as IconStyle,

  colorGeneration: {
    backgroundLuminosity: 96,
    surfaceLuminosityOffset: -2,
    foregroundContrast: 90,
    secondaryLuminosityOffset: 25,
    mutedLuminosityOffset: 40,
    neutralSaturation: 3,
    darkModeLuminosityScale: 6,
    darkModeSaturationBoost: 5,
    shadowTint: 'neutral',
    shadowOpacity: 0.25,
    pageBackgroundOpacity: 0.25,
  },

  pageBackground: {
    pattern: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect fill="none" width="20" height="20"/><path d="M0 10 L20 10 M10 0 L10 20" stroke="PLACEHOLDER" stroke-width="1" opacity="OPACITY"/><circle cx="10" cy="10" r="1.5" fill="PLACEHOLDER" opacity="OPACITY"/></svg>`,
    usePrimaryTint: false,
  },

  mobile: {
    spacingMultiplier: 0.9,
    borderRadiusMultiplier: 0.4,
    shadowReduction: 0.2,
    fontScale: 0.95,
    touchTargetSize: '44px',
  },

  tags: ['brutalist', 'industrial', 'raw', 'construction', 'grid'],
  category: 'technical',
};

/**
 * 8. ORGANIC - Scandinavian/Nature Aesthetic
 * Warm tones, soft shadows, natural inspiration
 * Like: Scandinavian design, nature, sustainability brands
 */
export const organicPersonality: Personality = {
  id: 'organic',
  name: 'Organic',
  description: 'Natural warmth - soft shadows, earthy tones, organic forms.',
  version: '2.0.0',

  colorHarmony: {
    type: 'analogous' as ColorHarmonyType,
    saturationBoost: -0.2,
    lightnessShift: 0.12,
    accentSaturation: 45,
    accentLightness: 55,
    analogousSpread: 35,
  },

  contrast: {
    minimumRatio: 4.5,
    enhancedRatio: 7,
    backgroundOffset: 0.06,
    autoAdjust: true,
  },

  tokens: {
    spacingScale: 'spacious' as SpacingScale,
    spacingMultiplier: 1.2,
    borderRadius: 'round' as BorderRadiusStyle,
    borderRadiusMultiplier: 1.5,
    borderStyle: 'thin' as BorderStyle,
    borderWidth: '1px',
    shadowIntensity: 'subtle' as ShadowIntensity,
    shadowMultiplier: 0.6,
    typography: 'elegant' as TypographyStyle,
    lineHeight: 1.65,
    letterSpacing: '0.01em',
  },

  fonts: {
    body: {
      family: '"Nunito Sans", "Source Sans Pro", system-ui, sans-serif',
      weights: [300, 400, 600],
      display: 'swap',
      preload: true,
    },
    heading: {
      family: '"Nunito", "Quicksand", system-ui, sans-serif',
      weights: [600, 700, 800],
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
    staggerDelay: '90ms',
    prefersReducedMotion: true,
  },

  iconStyle: 'rounded' as IconStyle,

  colorGeneration: {
    backgroundLuminosity: 99,
    surfaceLuminosityOffset: -2,
    foregroundContrast: 88,
    secondaryLuminosityOffset: 25,
    mutedLuminosityOffset: 40,
    neutralSaturation: 18,
    darkModeLuminosityScale: 6,
    darkModeSaturationBoost: 5,
    shadowTint: 'warm',
    shadowOpacity: 0.06,
    pageBackgroundOpacity: 0.06,
  },

  pageBackground: {
    pattern: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="none" width="100" height="100"/><circle cx="50" cy="50" r="40" fill="PLACEHOLDER" opacity="OPACITY"/><circle cx="20" cy="20" r="10" fill="PLACEHOLDER" opacity="OPACITY"/></svg>`,
    usePrimaryTint: false,
  },

  mobile: {
    spacingMultiplier: 1.1,
    borderRadiusMultiplier: 1.4,
    shadowReduction: 0.4,
    fontScale: 0.95,
    touchTargetSize: '48px',
  },

  tags: ['scandinavian', 'nature', 'warm', 'organic', 'earthy'],
  category: 'casual',
};

/**
 * All predefined personalities (8 consolidated)
 */
export const PREDEFINED_PERSONALITIES: Personality[] = [
  classicPersonality,
  minimalPersonality,
  editorialPersonality,
  boldPersonality,
  playfulPersonality,
  cyberPersonality,
  industrialPersonality,
  organicPersonality,
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
  // Generate preview colors from colorGeneration settings
  const bgLum = personality.colorGeneration?.backgroundLuminosity ?? 98;
  const fgContrast = personality.colorGeneration?.foregroundContrast ?? 90;

  // Create hex colors based on luminosity
  const lightBg = `hsl(0, 0%, ${bgLum}%)`;
  const lightFg = `hsl(0, 0%, ${Math.max(0, bgLum - fgContrast)}%)`;
  const darkBg = `hsl(0, 0%, ${Math.max(5, 100 - bgLum)}%)`;
  const darkFg = `hsl(0, 0%, ${Math.min(95, 100 - bgLum + fgContrast)}%)`;

  return {
    light: [lightBg, lightFg],
    dark: [darkBg, darkFg],
  };
}

// Legacy exports for backward compatibility
export { classicPersonality as professionalPersonality };
export { classicPersonality as elegantPersonality };
export { playfulPersonality as softPersonality };
export { playfulPersonality as softTouchPersonality };
export { cyberPersonality as electricPersonality };
export { cyberPersonality as controlCenterPersonality };
export { industrialPersonality as architectPersonality };
export { minimalPersonality as foundationPersonality };
