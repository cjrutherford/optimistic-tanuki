/**
 * Predefined personality presets for the design system
 * Each personality provides a complete aesthetic configuration
 */

import {
  Personality,
  PersonalityPresentation,
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

  colorGeneration: {
    backgroundLuminosity: 100,
    surfaceLuminosityOffset: -2,
    foregroundContrast: 92,
    secondaryLuminosityOffset: 35,
    mutedLuminosityOffset: 55,
    neutralSaturation: 0,
    darkModeLuminosityScale: 5,
    darkModeSaturationBoost: 0,
    shadowTint: 'neutral',
    shadowOpacity: 0.1,
    pageBackgroundOpacity: 0.05,
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

  colorGeneration: {
    backgroundLuminosity: 98,
    surfaceLuminosityOffset: -2,
    foregroundContrast: 94,
    secondaryLuminosityOffset: 40,
    mutedLuminosityOffset: 58,
    neutralSaturation: 5,
    darkModeLuminosityScale: 5,
    darkModeSaturationBoost: 2,
    shadowTint: 'neutral',
    shadowOpacity: 0,
    pageBackgroundOpacity: 0.02,
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

  colorGeneration: {
    backgroundLuminosity: 98,
    surfaceLuminosityOffset: -3,
    foregroundContrast: 90,
    secondaryLuminosityOffset: 38,
    mutedLuminosityOffset: 52,
    neutralSaturation: 15,
    darkModeLuminosityScale: 8,
    darkModeSaturationBoost: 5,
    shadowTint: 'primary-tint',
    shadowOpacity: 0.15,
    pageBackgroundOpacity: 0.08,
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

  colorGeneration: {
    backgroundLuminosity: 99,
    surfaceLuminosityOffset: -1,
    foregroundContrast: 88,
    secondaryLuminosityOffset: 42,
    mutedLuminosityOffset: 60,
    neutralSaturation: 12,
    darkModeLuminosityScale: 12,
    darkModeSaturationBoost: 8,
    shadowTint: 'primary-tint',
    shadowOpacity: 0.08,
    pageBackgroundOpacity: 0.03,
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

  colorGeneration: {
    backgroundLuminosity: 98,
    surfaceLuminosityOffset: -2,
    foregroundContrast: 88,
    secondaryLuminosityOffset: 35,
    mutedLuminosityOffset: 50,
    neutralSaturation: 8,
    darkModeLuminosityScale: 6,
    darkModeSaturationBoost: 3,
    shadowTint: 'warm',
    shadowOpacity: 0.06,
    pageBackgroundOpacity: 0.04,
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

  colorGeneration: {
    backgroundLuminosity: 98,
    surfaceLuminosityOffset: -4,
    foregroundContrast: 95,
    secondaryLuminosityOffset: 45,
    mutedLuminosityOffset: 62,
    neutralSaturation: 0,
    darkModeLuminosityScale: 5,
    darkModeSaturationBoost: 10,
    shadowTint: 'cool',
    shadowOpacity: 0.2,
    pageBackgroundOpacity: 0.06,
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

  colorGeneration: {
    backgroundLuminosity: 96,
    surfaceLuminosityOffset: -3,
    foregroundContrast: 90,
    secondaryLuminosityOffset: 40,
    mutedLuminosityOffset: 55,
    neutralSaturation: 3,
    darkModeLuminosityScale: 6,
    darkModeSaturationBoost: 2,
    shadowTint: 'neutral',
    shadowOpacity: 0.25,
    pageBackgroundOpacity: 0.05,
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
 * Architect personality - Brutalist Industrial
 * Raw, structural, bold with monospace typography and hard shadows
 * Best for: Developer tools, architecture portfolios, technical documentation
 */
export const architectPersonality: Personality = {
  id: 'architect',
  name: 'Architect',
  description:
    'Brutalist industrial aesthetic - raw, structural, bold with monospace typography',
  version: '1.0.0',

  colorHarmony: {
    type: 'split-complementary' as ColorHarmonyType,
    saturationBoost: 0.15,
    lightnessShift: -0.05,
    accentSaturation: 75,
    accentLightness: 45,
  },

  contrast: {
    minimumRatio: 4.5,
    enhancedRatio: 7,
    backgroundOffset: 0.08,
    autoAdjust: true,
  },

  tokens: {
    spacingScale: 'comfortable' as SpacingScale,
    spacingMultiplier: 0.95,
    borderRadius: 'sharp' as BorderRadiusStyle,
    borderRadiusMultiplier: 0.5,
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
      family: '"IBM Plex Mono", "Courier New", monospace',
      weights: [400, 500, 600, 700],
      display: 'swap',
      preload: true,
    },
    heading: {
      family: '"Oswald", "Impact", sans-serif',
      weights: [400, 500, 600, 700],
      display: 'swap',
      preload: true,
    },
    mono: {
      family: '"IBM Plex Mono", monospace',
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
    backgroundLuminosity: 99,
    surfaceLuminosityOffset: -2,
    foregroundContrast: 88,
    secondaryLuminosityOffset: 38,
    mutedLuminosityOffset: 52,
    neutralSaturation: 18,
    darkModeLuminosityScale: 10,
    darkModeSaturationBoost: 12,
    shadowTint: 'warm',
    shadowOpacity: 0.06,
    pageBackgroundOpacity: 0.04,
  },

  mobile: {
    spacingMultiplier: 0.85,
    borderRadiusMultiplier: 0.5,
    shadowReduction: 0.2,
    fontScale: 0.95,
    touchTargetSize: '44px',
  },

  tags: ['brutalist', 'industrial', 'structural', 'bold', 'technical'],
  category: 'technical',
};

/**
 * Soft Touch personality - Organic Warm
 * Gentle, pill-shaped, ultra-soft with rounded corners
 * Best for: Wellness apps, form-heavy UIs, educational content
 */
export const softTouchPersonality: Personality = {
  id: 'soft-touch',
  name: 'Soft Touch',
  description:
    'Organic warm aesthetic - gentle, pill-shaped, ultra-soft with rounded corners',
  version: '1.0.0',

  colorHarmony: {
    type: 'analogous' as ColorHarmonyType,
    saturationBoost: -0.25,
    lightnessShift: 0.12,
    accentSaturation: 40,
    accentLightness: 60,
    analogousSpread: 30,
  },

  contrast: {
    minimumRatio: 4.5,
    enhancedRatio: 7,
    backgroundOffset: 0.06,
    autoAdjust: true,
  },

  tokens: {
    spacingScale: 'airy' as SpacingScale,
    spacingMultiplier: 1.25,
    borderRadius: 'round' as BorderRadiusStyle,
    borderRadiusMultiplier: 1.75,
    borderStyle: 'thin' as BorderStyle,
    borderWidth: '0.5px',
    shadowIntensity: 'subtle' as ShadowIntensity,
    shadowMultiplier: 0.5,
    typography: 'elegant' as TypographyStyle,
    lineHeight: 1.7,
    letterSpacing: '0.01em',
  },

  fonts: {
    body: {
      family: '"Nunito", system-ui, sans-serif',
      weights: [300, 400, 500, 600],
      display: 'swap',
      preload: true,
    },
    heading: {
      family: '"Quicksand", system-ui, sans-serif',
      weights: [400, 500, 600, 700],
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
      normal: '350ms',
      slow: '600ms',
    },
    staggerDelay: '80ms',
    prefersReducedMotion: true,
  },

  iconStyle: 'rounded' as IconStyle,

  colorGeneration: {
    backgroundLuminosity: 99,
    surfaceLuminosityOffset: -1,
    foregroundContrast: 88,
    secondaryLuminosityOffset: 42,
    mutedLuminosityOffset: 58,
    neutralSaturation: 10,
    darkModeLuminosityScale: 8,
    darkModeSaturationBoost: 6,
    shadowTint: 'warm',
    shadowOpacity: 0.04,
    pageBackgroundOpacity: 0.03,
  },

  mobile: {
    spacingMultiplier: 0.9,
    borderRadiusMultiplier: 1.5,
    shadowReduction: 0.5,
    fontScale: 0.95,
    touchTargetSize: '48px',
  },

  tags: ['organic', 'warm', 'gentle', 'soft', 'friendly'],
  category: 'casual',
};

/**
 * Electric personality - Vibrant Kinetic
 * Energetic, warm colors, playful with bold color gradients
 * Best for: Social media, community platforms, creative galleries
 */
export const electricPersonality: Personality = {
  id: 'electric',
  name: 'Electric',
  description:
    'Vibrant kinetic aesthetic - energetic, warm, conversational with bold colors',
  version: '1.0.0',

  colorHarmony: {
    type: 'triadic' as ColorHarmonyType,
    saturationBoost: 0.35,
    lightnessShift: 0,
    accentSaturation: 85,
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
    spacingMultiplier: 1.1,
    borderRadius: 'soft' as BorderRadiusStyle,
    borderRadiusMultiplier: 1.1,
    borderStyle: 'thick' as BorderStyle,
    borderWidth: '2px',
    shadowIntensity: 'dramatic' as ShadowIntensity,
    shadowMultiplier: 1.4,
    typography: 'playful' as TypographyStyle,
    lineHeight: 1.45,
    letterSpacing: '0em',
  },

  fonts: {
    body: {
      family: '"Work Sans", system-ui, sans-serif',
      weights: [400, 500, 600, 700],
      display: 'swap',
      preload: true,
    },
    heading: {
      family: '"DM Serif Display", Georgia, serif',
      weights: [400],
      display: 'swap',
      preload: true,
    },
    mono: {
      family: '"JetBrains Mono", monospace',
      weights: [400, 500],
      display: 'swap',
      preload: true,
    },
  },

  animations: {
    speed: 'normal' as AnimationSpeed,
    easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    duration: {
      instant: '0ms',
      fast: '100ms',
      normal: '250ms',
      slow: '400ms',
    },
    staggerDelay: '60ms',
    prefersReducedMotion: false,
  },

  iconStyle: 'two-tone' as IconStyle,

  colorGeneration: {
    backgroundLuminosity: 99,
    surfaceLuminosityOffset: -2,
    foregroundContrast: 90,
    secondaryLuminosityOffset: 40,
    mutedLuminosityOffset: 55,
    neutralSaturation: 14,
    darkModeLuminosityScale: 7,
    darkModeSaturationBoost: 8,
    shadowTint: 'primary-tint',
    shadowOpacity: 0.1,
    pageBackgroundOpacity: 0.06,
  },

  mobile: {
    spacingMultiplier: 0.95,
    borderRadiusMultiplier: 1.0,
    shadowReduction: 0.15,
    fontScale: 1.0,
    touchTargetSize: '48px',
  },

  tags: ['vibrant', 'energetic', 'kinetic', 'playful', 'social'],
  category: 'creative',
};

/**
 * Control Center personality - Technical Dashboard
 * Precise, monospace, grid-based with inset shadows
 * Best for: Admin panels, monitoring dashboards, configuration UIs
 */
export const controlCenterPersonality: Personality = {
  id: 'control-center',
  name: 'Control Center',
  description:
    'Technical dashboard aesthetic - precise, monospace, grid-based with inset shadows',
  version: '1.0.0',

  colorHarmony: {
    type: 'analogous' as ColorHarmonyType,
    saturationBoost: -0.1,
    lightnessShift: 0.05,
    accentSaturation: 55,
    accentLightness: 48,
    analogousSpread: 20,
  },

  contrast: {
    minimumRatio: 7,
    enhancedRatio: 7,
    backgroundOffset: 0.03,
    autoAdjust: true,
  },

  tokens: {
    spacingScale: 'compact' as SpacingScale,
    spacingMultiplier: 0.9,
    borderRadius: 'sharp' as BorderRadiusStyle,
    borderRadiusMultiplier: 0.4,
    borderStyle: 'thin' as BorderStyle,
    borderWidth: '1px',
    shadowIntensity: 'medium' as ShadowIntensity,
    shadowMultiplier: 0.7,
    typography: 'modern' as TypographyStyle,
    lineHeight: 1.5,
    letterSpacing: '0.02em',
  },

  fonts: {
    body: {
      family: '"IBM Plex Sans", system-ui, sans-serif',
      weights: [400, 500, 600],
      display: 'swap',
      preload: true,
    },
    heading: {
      family: '"Space Grotesk", system-ui, sans-serif',
      weights: [500, 600, 700],
      display: 'swap',
      preload: true,
    },
    mono: {
      family: '"JetBrains Mono", "Fira Code", monospace',
      weights: [400, 500],
      display: 'swap',
      preload: true,
    },
  },

  animations: {
    speed: 'fast' as AnimationSpeed,
    easing: 'steps(3, end)',
    duration: {
      instant: '0ms',
      fast: '50ms',
      normal: '100ms',
      slow: '200ms',
    },
    staggerDelay: '15ms',
    prefersReducedMotion: true,
  },

  iconStyle: 'outlined' as IconStyle,

  colorGeneration: {
    backgroundLuminosity: 97,
    surfaceLuminosityOffset: -3,
    foregroundContrast: 92,
    secondaryLuminosityOffset: 38,
    mutedLuminosityOffset: 54,
    neutralSaturation: 6,
    darkModeLuminosityScale: 6,
    darkModeSaturationBoost: 4,
    shadowTint: 'cool',
    shadowOpacity: 0.12,
    pageBackgroundOpacity: 0.05,
  },

  pageBackground: {
    pattern: `<svg width="20" height="20" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="grid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M0 10 L20 10 M10 0 L10 20" stroke="currentColor" stroke-width="0.5" fill="none" opacity="0.5"/></pattern></defs><rect width="20" height="20" fill="url(#grid)"/></svg>`,
    usePrimaryTint: false,
  },

  mobile: {
    spacingMultiplier: 0.85,
    borderRadiusMultiplier: 0.35,
    shadowReduction: 0.4,
    fontScale: 0.92,
    touchTargetSize: '44px',
  },

  tags: ['technical', 'dashboard', 'monospace', 'grid', 'precision'],
  category: 'technical',
};

/**
 * Foundation personality - Base Infrastructure
 * Minimal, functional, no-frills with maximum clarity
 * Best for: Getting started, prototyping, utilitarian interfaces
 */
export const foundationPersonality: Personality = {
  id: 'foundation',
  name: 'Foundation',
  description:
    'Base infrastructure - minimal, functional, no-frills with maximum clarity',
  version: '1.0.0',

  colorHarmony: {
    type: 'complementary' as ColorHarmonyType,
    saturationBoost: -0.15,
    lightnessShift: 0,
    accentSaturation: 60,
    accentLightness: 50,
  },

  contrast: {
    minimumRatio: 7,
    enhancedRatio: 7,
    backgroundOffset: 0.02,
    autoAdjust: true,
  },

  tokens: {
    spacingScale: 'compact' as SpacingScale,
    spacingMultiplier: 0.85,
    borderRadius: 'sharp' as BorderRadiusStyle,
    borderRadiusMultiplier: 0.75,
    borderStyle: 'hairline' as BorderStyle,
    borderWidth: '0.5px',
    shadowIntensity: 'subtle' as ShadowIntensity,
    shadowMultiplier: 0.5,
    typography: 'clean' as TypographyStyle,
    lineHeight: 1.5,
    letterSpacing: 'normal',
  },

  fonts: {
    body: {
      family:
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      weights: [400, 500, 600],
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
      family: '"SF Mono", Monaco, "Inconsolata", monospace',
      weights: [400, 500],
      display: 'swap',
      preload: false,
    },
  },

  animations: {
    speed: 'fast' as AnimationSpeed,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    duration: {
      instant: '0ms',
      fast: '75ms',
      normal: '150ms',
      slow: '250ms',
    },
    staggerDelay: '25ms',
    prefersReducedMotion: true,
  },

  iconStyle: 'outlined' as IconStyle,

  colorGeneration: {
    backgroundLuminosity: 100,
    surfaceLuminosityOffset: -1,
    foregroundContrast: 95,
    secondaryLuminosityOffset: 50,
    mutedLuminosityOffset: 65,
    neutralSaturation: 2,
    darkModeLuminosityScale: 6,
    darkModeSaturationBoost: 1,
    shadowTint: 'neutral',
    shadowOpacity: 0.05,
    pageBackgroundOpacity: 0,
  },

  mobile: {
    spacingMultiplier: 0.8,
    borderRadiusMultiplier: 0.7,
    shadowReduction: 0.5,
    fontScale: 0.9,
    touchTargetSize: '44px',
  },

  tags: ['minimal', 'functional', 'clean', 'utilitarian', 'base'],
  category: 'technical',
};

function createPresentation(
  config: PersonalityPresentation
): PersonalityPresentation {
  return config;
}

const PRESENTATION_BY_ID: Record<string, PersonalityPresentation> = {
  classic: createPresentation({
    border: {
      style: 'solid',
      width: 'thin',
      radius: 'small',
      styleValue: 'solid',
      widthValue: '1px',
      radiusValue: '4px',
    },
    shadow: { style: 'subtle', value: '0 2px 4px rgba(0,0,0,0.1)' },
    typography: {
      fontFamily: 'sans-serif',
      headingFamily: 'sans-serif',
      bodyFamily: 'sans-serif',
      fontWeight: 'normal',
      fontStyle: 'normal',
      familyValue: "'Inter', -apple-system, sans-serif",
      headingFamilyValue: "'Inter', -apple-system, sans-serif",
      bodyFamilyValue: "'Inter', -apple-system, sans-serif",
      weightValue: '400',
    },
    animation: {
      style: 'subtle',
      speed: 'normal',
      timingFunction: 'ease',
      duration: '0.2s',
      transition: 'all 0.2s ease',
    },
    layout: { borderRadius: '8px', spacing: 'normal', maxWidth: '72rem' },
    components: {
      button: {
        borderRadius: '4px',
        padding: '8px 16px',
        fontWeight: '500',
        textTransform: 'none',
      },
      card: {
        borderRadius: '8px',
        padding: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      },
      input: {
        borderRadius: '4px',
        borderWidth: '1px',
        focusStyle: '0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent)',
      },
    },
  }),
  bold: createPresentation({
    border: {
      style: 'solid',
      width: 'thick',
      radius: 'medium',
      styleValue: 'solid',
      widthValue: '3px',
      radiusValue: '8px',
    },
    shadow: { style: 'dramatic', value: '4px 4px 0px rgba(0,0,0,0.2)' },
    typography: {
      fontFamily: 'sans-serif',
      headingFamily: 'sans-serif',
      bodyFamily: 'sans-serif',
      fontWeight: 'bold',
      fontStyle: 'normal',
      familyValue: "'Inter', -apple-system, sans-serif",
      headingFamilyValue: "'Inter', -apple-system, sans-serif",
      bodyFamilyValue: "'Inter', -apple-system, sans-serif",
      weightValue: '700',
    },
    animation: {
      style: 'bouncy',
      speed: 'normal',
      timingFunction: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      duration: '0.3s',
      transition: 'all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
    layout: { borderRadius: '12px', spacing: 'normal', maxWidth: '70rem' },
    components: {
      button: {
        borderRadius: '8px',
        padding: '12px 24px',
        fontWeight: '700',
        textTransform: 'none',
      },
      card: {
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '6px 6px 0px rgba(0,0,0,0.15)',
      },
      input: {
        borderRadius: '8px',
        borderWidth: '3px',
        focusStyle: '0 0 0 4px color-mix(in srgb, var(--primary) 24%, transparent)',
      },
    },
  }),
  soft: createPresentation({
    border: {
      style: 'solid',
      width: 'thin',
      radius: 'large',
      styleValue: 'solid',
      widthValue: '1px',
      radiusValue: '16px',
    },
    shadow: { style: 'subtle', value: '0 4px 12px rgba(0,0,0,0.06)' },
    typography: {
      fontFamily: 'serif',
      headingFamily: 'serif',
      bodyFamily: 'serif',
      fontWeight: 'light',
      fontStyle: 'normal',
      familyValue: "'Georgia', 'Times New Roman', serif",
      headingFamilyValue: "'Georgia', 'Times New Roman', serif",
      bodyFamilyValue: "'Georgia', 'Times New Roman', serif",
      weightValue: '300',
    },
    animation: {
      style: 'flowing',
      speed: 'slow',
      timingFunction: 'ease-out',
      duration: '0.4s',
      transition: 'all 0.4s ease-out',
    },
    layout: { borderRadius: '20px', spacing: 'relaxed', maxWidth: '72rem' },
    components: {
      button: {
        borderRadius: '24px',
        padding: '12px 28px',
        fontWeight: '400',
        textTransform: 'none',
      },
      card: {
        borderRadius: '20px',
        padding: '24px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
      },
      input: {
        borderRadius: '12px',
        borderWidth: '1px',
        focusStyle: '0 0 0 3px color-mix(in srgb, var(--primary) 14%, transparent)',
      },
    },
  }),
  professional: createPresentation({
    border: {
      style: 'solid',
      width: 'thin',
      radius: 'small',
      styleValue: 'solid',
      widthValue: '1px',
      radiusValue: '4px',
    },
    shadow: { style: 'subtle', value: '0 1px 3px rgba(0,0,0,0.1)' },
    typography: {
      fontFamily: 'sans-serif',
      headingFamily: 'sans-serif',
      bodyFamily: 'sans-serif',
      fontWeight: 'medium',
      fontStyle: 'normal',
      familyValue: "'Roboto', 'Segoe UI', sans-serif",
      headingFamilyValue: "'Roboto', 'Segoe UI', sans-serif",
      bodyFamilyValue: "'Roboto', 'Segoe UI', sans-serif",
      weightValue: '500',
    },
    animation: {
      style: 'none',
      speed: 'fast',
      timingFunction: 'linear',
      duration: '0s',
      transition: 'none',
    },
    layout: { borderRadius: '4px', spacing: 'normal', maxWidth: '76rem' },
    components: {
      button: {
        borderRadius: '4px',
        padding: '10px 20px',
        fontWeight: '500',
        textTransform: 'none',
      },
      card: {
        borderRadius: '4px',
        padding: '16px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      },
      input: {
        borderRadius: '4px',
        borderWidth: '1px',
        focusStyle: '0 0 0 2px color-mix(in srgb, var(--primary) 18%, transparent)',
      },
    },
  }),
  playful: createPresentation({
    border: {
      style: 'dashed',
      width: 'medium',
      radius: 'pill',
      styleValue: 'dashed',
      widthValue: '2px',
      radiusValue: '9999px',
    },
    shadow: { style: 'neon', value: '0 0 10px rgba(0,0,0,0.15)' },
    typography: {
      fontFamily: 'display',
      headingFamily: 'display',
      bodyFamily: 'display',
      fontWeight: 'bold',
      fontStyle: 'normal',
      familyValue: "'Poppins', 'Comic Sans MS', cursive",
      headingFamilyValue: "'Poppins', 'Comic Sans MS', cursive",
      bodyFamilyValue: "'Poppins', 'Comic Sans MS', cursive",
      weightValue: '700',
    },
    animation: {
      style: 'bouncy',
      speed: 'normal',
      timingFunction: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      duration: '0.3s',
      transition: 'all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
    layout: { borderRadius: '24px', spacing: 'relaxed', maxWidth: '68rem' },
    components: {
      button: {
        borderRadius: '9999px',
        padding: '14px 32px',
        fontWeight: '700',
        textTransform: 'none',
      },
      card: {
        borderRadius: '24px',
        padding: '24px',
        boxShadow: '0 0 15px rgba(0,0,0,0.1)',
      },
      input: {
        borderRadius: '16px',
        borderWidth: '2px',
        focusStyle: '0 0 0 4px color-mix(in srgb, var(--primary) 24%, transparent)',
      },
    },
  }),
  elegant: createPresentation({
    border: {
      style: 'double',
      width: 'thick',
      radius: 'none',
      styleValue: 'double',
      widthValue: '3px',
      radiusValue: '0px',
    },
    shadow: { style: 'dramatic', value: '0 10px 30px rgba(0,0,0,0.2)' },
    typography: {
      fontFamily: 'serif',
      headingFamily: 'serif',
      bodyFamily: 'serif',
      fontWeight: 'normal',
      fontStyle: 'normal',
      familyValue: "'Playfair Display', 'Times New Roman', serif",
      headingFamilyValue: "'Playfair Display', 'Times New Roman', serif",
      bodyFamilyValue: "'Playfair Display', 'Times New Roman', serif",
      weightValue: '400',
    },
    animation: {
      style: 'subtle',
      speed: 'normal',
      timingFunction: 'ease',
      duration: '0.3s',
      transition: 'all 0.3s ease',
    },
    layout: { borderRadius: '0px', spacing: 'normal', maxWidth: '70rem' },
    components: {
      button: {
        borderRadius: '0px',
        padding: '12px 24px',
        fontWeight: '400',
        textTransform: 'uppercase',
      },
      card: {
        borderRadius: '0px',
        padding: '24px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      },
      input: {
        borderRadius: '0px',
        borderWidth: '1px',
        focusStyle: '0 0 0 2px color-mix(in srgb, var(--primary) 16%, transparent)',
      },
    },
  }),
  minimal: createPresentation({
    border: {
      style: 'solid',
      width: 'thin',
      radius: 'none',
      styleValue: 'solid',
      widthValue: '1px',
      radiusValue: '0px',
    },
    shadow: { style: 'none', value: 'none' },
    typography: {
      fontFamily: 'sans-serif',
      headingFamily: 'sans-serif',
      bodyFamily: 'sans-serif',
      fontWeight: 'normal',
      fontStyle: 'normal',
      familyValue: "'Helvetica Neue', 'Arial', sans-serif",
      headingFamilyValue: "'Helvetica Neue', 'Arial', sans-serif",
      bodyFamilyValue: "'Helvetica Neue', 'Arial', sans-serif",
      weightValue: '400',
    },
    animation: {
      style: 'none',
      speed: 'fast',
      timingFunction: 'linear',
      duration: '0s',
      transition: 'none',
    },
    layout: { borderRadius: '0px', spacing: 'compact', maxWidth: '76rem' },
    components: {
      button: {
        borderRadius: '0px',
        padding: '10px 20px',
        fontWeight: '400',
        textTransform: 'none',
      },
      card: {
        borderRadius: '0px',
        padding: '16px',
        boxShadow: 'none',
      },
      input: {
        borderRadius: '0px',
        borderWidth: '1px',
        focusStyle: '0 0 0 2px color-mix(in srgb, var(--primary) 10%, transparent)',
      },
    },
  }),
  architect: createPresentation({
    border: {
      style: 'solid',
      width: 'thick',
      radius: 'none',
      styleValue: 'solid',
      widthValue: '3px',
      radiusValue: '0px',
    },
    shadow: { style: 'dramatic', value: '6px 6px 0px rgba(0,0,0,0.18)' },
    typography: {
      fontFamily: 'display',
      headingFamily: 'display',
      bodyFamily: 'sans-serif',
      fontWeight: 'extrabold',
      fontStyle: 'normal',
      familyValue: "'Oswald', 'Arial Narrow', sans-serif",
      headingFamilyValue: "'Oswald', 'Arial Narrow', sans-serif",
      bodyFamilyValue: "'IBM Plex Sans', sans-serif",
      weightValue: '800',
    },
    animation: {
      style: 'subtle',
      speed: 'normal',
      timingFunction: 'steps(2)',
      duration: '0.2s',
      transition: 'all 0.2s steps(2)',
    },
    layout: { borderRadius: '0px', spacing: 'compact', maxWidth: '74rem' },
    components: {
      button: {
        borderRadius: '0px',
        padding: '12px 20px',
        fontWeight: '800',
        textTransform: 'uppercase',
      },
      card: {
        borderRadius: '0px',
        padding: '20px',
        boxShadow: '8px 8px 0px rgba(0,0,0,0.14)',
      },
      input: {
        borderRadius: '0px',
        borderWidth: '3px',
        focusStyle: '0 0 0 3px color-mix(in srgb, var(--primary) 20%, transparent)',
      },
    },
  }),
  'soft-touch': createPresentation({
    border: {
      style: 'solid',
      width: 'thin',
      radius: 'pill',
      styleValue: 'solid',
      widthValue: '1px',
      radiusValue: '9999px',
    },
    shadow: { style: 'glow', value: '0 8px 22px rgba(0,0,0,0.08)' },
    typography: {
      fontFamily: 'handwritten',
      headingFamily: 'sans-serif',
      bodyFamily: 'sans-serif',
      fontWeight: 'normal',
      fontStyle: 'normal',
      familyValue: "'Quicksand', 'Nunito', sans-serif",
      headingFamilyValue: "'Quicksand', 'Nunito', sans-serif",
      bodyFamilyValue: "'Nunito', sans-serif",
      weightValue: '400',
    },
    animation: {
      style: 'flowing',
      speed: 'slow',
      timingFunction: 'ease-out',
      duration: '0.35s',
      transition: 'all 0.35s ease-out',
    },
    layout: { borderRadius: '24px', spacing: 'relaxed', maxWidth: '72rem' },
    components: {
      button: {
        borderRadius: '9999px',
        padding: '12px 26px',
        fontWeight: '500',
        textTransform: 'none',
      },
      card: {
        borderRadius: '20px',
        padding: '24px',
        boxShadow: '0 12px 28px rgba(0,0,0,0.08)',
      },
      input: {
        borderRadius: '18px',
        borderWidth: '1px',
        focusStyle: '0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent)',
      },
    },
  }),
  electric: createPresentation({
    border: {
      style: 'solid',
      width: 'medium',
      radius: 'medium',
      styleValue: 'solid',
      widthValue: '2px',
      radiusValue: '10px',
    },
    shadow: { style: 'neon', value: '0 0 18px rgba(0,0,0,0.16)' },
    typography: {
      fontFamily: 'display',
      headingFamily: 'display',
      bodyFamily: 'sans-serif',
      fontWeight: 'bold',
      fontStyle: 'normal',
      familyValue: "'DM Serif Display', 'Georgia', serif",
      headingFamilyValue: "'DM Serif Display', 'Georgia', serif",
      bodyFamilyValue: "'Inter', -apple-system, sans-serif",
      weightValue: '700',
    },
    animation: {
      style: 'pulsing',
      speed: 'normal',
      timingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)',
      duration: '0.25s',
      transition: 'all 0.25s cubic-bezier(0.23, 1, 0.32, 1)',
    },
    layout: { borderRadius: '12px', spacing: 'normal', maxWidth: '72rem' },
    components: {
      button: {
        borderRadius: '10px',
        padding: '12px 24px',
        fontWeight: '700',
        textTransform: 'uppercase',
      },
      card: {
        borderRadius: '14px',
        padding: '20px',
        boxShadow: '0 0 22px rgba(0,0,0,0.14)',
      },
      input: {
        borderRadius: '10px',
        borderWidth: '2px',
        focusStyle: '0 0 0 4px color-mix(in srgb, var(--primary) 28%, transparent)',
      },
    },
  }),
  'control-center': createPresentation({
    border: {
      style: 'solid',
      width: 'thin',
      radius: 'small',
      styleValue: 'solid',
      widthValue: '1px',
      radiusValue: '4px',
    },
    shadow: { style: 'medium', value: '0 1px 2px rgba(0,0,0,0.16)' },
    typography: {
      fontFamily: 'monospace',
      headingFamily: 'display',
      bodyFamily: 'monospace',
      fontWeight: 'medium',
      fontStyle: 'normal',
      familyValue: "'Space Grotesk', 'JetBrains Mono', monospace",
      headingFamilyValue: "'Space Grotesk', sans-serif",
      bodyFamilyValue: "'JetBrains Mono', monospace",
      weightValue: '500',
    },
    animation: {
      style: 'subtle',
      speed: 'fast',
      timingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)',
      duration: '0.18s',
      transition: 'all 0.18s cubic-bezier(0.23, 1, 0.32, 1)',
    },
    layout: { borderRadius: '4px', spacing: 'compact', maxWidth: '84rem' },
    components: {
      button: {
        borderRadius: '4px',
        padding: '10px 18px',
        fontWeight: '600',
        textTransform: 'uppercase',
      },
      card: {
        borderRadius: '4px',
        padding: '16px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
      },
      input: {
        borderRadius: '4px',
        borderWidth: '1px',
        focusStyle: '0 0 0 2px color-mix(in srgb, var(--primary) 22%, transparent)',
      },
    },
  }),
  foundation: createPresentation({
    border: {
      style: 'solid',
      width: 'thin',
      radius: 'none',
      styleValue: 'solid',
      widthValue: '1px',
      radiusValue: '0px',
    },
    shadow: { style: 'none', value: 'none' },
    typography: {
      fontFamily: 'sans-serif',
      headingFamily: 'sans-serif',
      bodyFamily: 'sans-serif',
      fontWeight: 'medium',
      fontStyle: 'normal',
      familyValue: "system-ui, -apple-system, sans-serif",
      headingFamilyValue: "system-ui, -apple-system, sans-serif",
      bodyFamilyValue: "system-ui, -apple-system, sans-serif",
      weightValue: '500',
    },
    animation: {
      style: 'none',
      speed: 'fast',
      timingFunction: 'linear',
      duration: '0s',
      transition: 'none',
    },
    layout: { borderRadius: '0px', spacing: 'compact', maxWidth: '80rem' },
    components: {
      button: {
        borderRadius: '0px',
        padding: '10px 18px',
        fontWeight: '500',
        textTransform: 'none',
      },
      card: {
        borderRadius: '0px',
        padding: '16px',
        boxShadow: 'none',
      },
      input: {
        borderRadius: '0px',
        borderWidth: '1px',
        focusStyle: '0 0 0 2px color-mix(in srgb, var(--primary) 12%, transparent)',
      },
    },
  }),
};

/**
 * All predefined personalities (12 total: 7 original + 5 library-promoted)
 */
export const PREDEFINED_PERSONALITIES: Personality[] = [
  classicPersonality,
  minimalPersonality,
  boldPersonality,
  softPersonality,
  professionalPersonality,
  playfulPersonality,
  elegantPersonality,
  architectPersonality,
  softTouchPersonality,
  electricPersonality,
  controlCenterPersonality,
  foundationPersonality,
].map((personality) => ({
  ...personality,
  presentation: PRESENTATION_BY_ID[personality.id],
}));

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
  return PREDEFINED_PERSONALITIES[0];
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
 * Uses colorGeneration to derive preview colors from primary color hue
 */
export function getPersonalityPreviewColors(
  personality: Personality,
  primaryColor = '#3f51b5'
): {
  light: string[];
  dark: string[];
} {
  // Extract hue from primary color
  const hue = extractHueFromHex(primaryColor);

  // Generate light mode colors based on personality parameters
  const lightBgHsl = {
    h: hue,
    s: personality.colorGeneration.neutralSaturation,
    l: personality.colorGeneration.backgroundLuminosity,
  };
  const lightFgHsl = {
    h: hue,
    s: personality.colorGeneration.neutralSaturation,
    l: Math.max(
      0,
      personality.colorGeneration.backgroundLuminosity -
        personality.colorGeneration.foregroundContrast
    ),
  };

  // Generate dark mode colors
  const darkLuminosity =
    personality.colorGeneration.backgroundLuminosity *
    (personality.colorGeneration.darkModeLuminosityScale / 100);
  const darkBgHsl = {
    h: hue,
    s: Math.min(
      100,
      personality.colorGeneration.neutralSaturation +
        personality.colorGeneration.darkModeSaturationBoost
    ),
    l: darkLuminosity,
  };
  const darkFgHsl = {
    h: hue,
    s: Math.min(
      100,
      personality.colorGeneration.neutralSaturation +
        personality.colorGeneration.darkModeSaturationBoost
    ),
    l: Math.min(
      100,
      darkLuminosity + personality.colorGeneration.foregroundContrast
    ),
  };

  return {
    light: [hslToHex(lightBgHsl), hslToHex(lightFgHsl)],
    dark: [hslToHex(darkBgHsl), hslToHex(darkFgHsl)],
  };
}

/**
 * Extract hue from hex color
 */
function extractHueFromHex(hex: string): number {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return 0;

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;

  if (max !== min) {
    const d = max - min;
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

  return h * 360;
}

/**
 * Convert HSL to hex
 */
function hslToHex({ h, s, l }: { h: number; s: number; l: number }): string {
  const hDecimal = h / 360;
  const sDecimal = s / 100;
  const lDecimal = l / 100;

  let r: number, g: number, b: number;

  if (sDecimal === 0) {
    r = g = b = lDecimal;
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q =
      lDecimal < 0.5
        ? lDecimal * (1 + sDecimal)
        : lDecimal + sDecimal - lDecimal * sDecimal;
    const p = 2 * lDecimal - q;
    r = hue2rgb(p, q, hDecimal + 1 / 3);
    g = hue2rgb(p, q, hDecimal);
    b = hue2rgb(p, q, hDecimal - 1 / 3);
  }

  const toHex = (x: number): string => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
