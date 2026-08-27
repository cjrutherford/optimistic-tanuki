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
  PersonalityShadowProfile,
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
    shadowProfile: 'layered' as PersonalityShadowProfile,
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
    // Classic's surface is the neutral default every other personality's
    // character is judged against (Workstream E1) — untinted, unshifted.
    surfaceHueBias: 'none',
    surfaceSaturationShift: 0,
  },

  // No `pageBackground`: flat is Classic's identity. It is the original,
  // neutral Optimistic Tanuki aesthetic — a page-level pattern would dilute
  // the "balanced, versatile default" character the personality exists to
  // provide. Intentional, not an oversight (Workstream C1).

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
    shadowIntensity: 'none' as ShadowIntensity,
    shadowMultiplier: 0.6,
    shadowProfile: 'minimal' as PersonalityShadowProfile,
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
    surfaceLuminosityOffset: -1,
    foregroundContrast: 94,
    secondaryLuminosityOffset: 40,
    mutedLuminosityOffset: 58,
    neutralSaturation: 5,
    darkModeLuminosityScale: 5,
    darkModeSaturationBoost: 2,
    shadowTint: 'neutral',
    shadowOpacity: 0,
    pageBackgroundOpacity: 0.02,
    // Minimal barely lifts off the background at all (Workstream E1) — the
    // smallest luminosity offset in the set — and stays fully untinted.
    surfaceHueBias: 'none',
    surfaceSaturationShift: 0,
  },

  // Ultra-sparse dot lattice: a single small dot per large tile keeps the
  // page nearly flat while still reading as intentional at very low opacity.
  pageBackground: {
    pattern: `<svg width="48" height="48" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="1" fill="currentColor"/></svg>`,
    usePrimaryTint: false,
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
    shadowProfile: 'playful-drop' as PersonalityShadowProfile,
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
    surfaceLuminosityOffset: -5,
    foregroundContrast: 90,
    secondaryLuminosityOffset: 38,
    mutedLuminosityOffset: 52,
    neutralSaturation: 15,
    darkModeLuminosityScale: 8,
    darkModeSaturationBoost: 5,
    shadowTint: 'primary-tint',
    shadowOpacity: 0.15,
    pageBackgroundOpacity: 0.08,
    // Bold makes "a strong visual statement" — a deeper surface lift and a
    // primary-tinted surface to match its primary-tinted shadow (Workstream
    // E1).
    surfaceHueBias: 'primary',
    surfaceSaturationShift: 6,
  },

  // Wide diagonal bands, primary-tinted: the statement-making, high-energy
  // motif that matches Bold's "makes a strong visual statement" brief.
  pageBackground: {
    pattern: `<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M0 40 L40 0 L40 14 L14 40 Z" fill="currentColor"/></svg>`,
    usePrimaryTint: true,
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
    'Gentle pastel tones with airy spacing, smooth transitions, and calming aesthetics.',
  version: '1.0.0',

  colorHarmony: {
    type: 'analogous' as ColorHarmonyType,
    saturationBoost: -0.2,
    lightnessShift: 0.18,
    accentSaturation: 42,
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
    shadowMultiplier: 0.6,
    shadowProfile: 'layered' as PersonalityShadowProfile,
    typography: 'elegant' as TypographyStyle,
    lineHeight: 1.7,
    letterSpacing: '0.02em',
  },

  fonts: {
    body: {
      family: '"Nunito Sans", system-ui, sans-serif',
      weights: [300, 400, 500],
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
    surfaceLuminosityOffset: -2,
    foregroundContrast: 88,
    secondaryLuminosityOffset: 42,
    mutedLuminosityOffset: 60,
    neutralSaturation: 8,
    darkModeLuminosityScale: 12,
    darkModeSaturationBoost: 6,
    shadowTint: 'primary-tint',
    shadowOpacity: 0.06,
    pageBackgroundOpacity: 0.03,
    // Gentle pastel warmth carries through to the surface, not just the
    // shadow (Workstream E1) — a soft warm-leaning lift.
    surfaceHueBias: 'warm',
    surfaceSaturationShift: 4,
  },

  // Large soft blobs, echoing the pastel/gentle "airy" brief without any
  // hard edges.
  pageBackground: {
    pattern: `<svg width="60" height="60" xmlns="http://www.w3.org/2000/svg"><ellipse cx="15" cy="15" rx="14" ry="10" fill="currentColor"/><ellipse cx="45" cy="45" rx="14" ry="10" fill="currentColor"/></svg>`,
    usePrimaryTint: false,
  },

  mobile: {
    spacingMultiplier: 0.85,
    borderRadiusMultiplier: 1.3,
    shadowReduction: 0.5,
    fontScale: 0.95,
    touchTargetSize: '44px',
  },

  tags: ['gentle', 'airy', 'calming', 'wellness'],
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
    borderRadius: 'sharp' as BorderRadiusStyle,
    borderRadiusMultiplier: 0.5,
    borderStyle: 'thin' as BorderStyle,
    borderWidth: '1px',
    shadowIntensity: 'medium' as ShadowIntensity,
    shadowMultiplier: 0.9,
    shadowProfile: 'layered' as PersonalityShadowProfile,
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
    surfaceLuminosityOffset: -3,
    foregroundContrast: 88,
    secondaryLuminosityOffset: 35,
    mutedLuminosityOffset: 50,
    neutralSaturation: 8,
    darkModeLuminosityScale: 6,
    darkModeSaturationBoost: 3,
    shadowTint: 'warm',
    shadowOpacity: 0.06,
    pageBackgroundOpacity: 0.03,
    // A cool, steely surface reads as conservative/trustworthy (Workstream
    // E1) — a modest lift, not a loud one.
    surfaceHueBias: 'cool',
    surfaceSaturationShift: 3,
  },

  // Fine pinstripe: a conservative, enterprise-appropriate texture at the
  // lowest opacity in the set.
  pageBackground: {
    pattern: `<svg width="8" height="8" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="1" height="8" fill="currentColor"/></svg>`,
    usePrimaryTint: false,
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
    shadowProfile: 'playful-drop' as PersonalityShadowProfile,
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
    surfaceLuminosityOffset: -7,
    foregroundContrast: 95,
    secondaryLuminosityOffset: 45,
    mutedLuminosityOffset: 62,
    neutralSaturation: 0,
    darkModeLuminosityScale: 5,
    darkModeSaturationBoost: 10,
    shadowTint: 'cool',
    shadowOpacity: 0.2,
    pageBackgroundOpacity: 0.06,
    // The most dramatic surface lift in the set (Workstream E1) — matches
    // playful's dramatic shadow intensity — with a warm-leaning tint for the
    // "energetic, varied, creative" brief.
    surfaceHueBias: 'warm',
    surfaceSaturationShift: 8,
  },

  // Scattered circles / confetti: varied sizes and positions for the
  // "energetic, varied, creative" brief.
  pageBackground: {
    pattern: `<svg width="36" height="36" xmlns="http://www.w3.org/2000/svg"><circle cx="6" cy="8" r="2" fill="currentColor"/><circle cx="22" cy="4" r="1.5" fill="currentColor"/><circle cx="30" cy="18" r="2.5" fill="currentColor"/><circle cx="12" cy="26" r="1.5" fill="currentColor"/><circle cx="26" cy="30" r="2" fill="currentColor"/></svg>`,
    usePrimaryTint: false,
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
    borderStyle: 'double' as BorderStyle,
    borderWidth: '3px',
    shadowIntensity: 'subtle' as ShadowIntensity,
    shadowMultiplier: 0.8,
    shadowProfile: 'diffuse' as PersonalityShadowProfile,
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
    speed: 'deliberate' as AnimationSpeed,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    duration: {
      instant: '0ms',
      fast: '200ms',
      normal: '550ms',
      slow: '900ms',
    },
    staggerDelay: '120ms',
    prefersReducedMotion: false,
  },

  iconStyle: 'outlined' as IconStyle,

  colorGeneration: {
    backgroundLuminosity: 96,
    surfaceLuminosityOffset: -4,
    foregroundContrast: 90,
    secondaryLuminosityOffset: 40,
    mutedLuminosityOffset: 55,
    neutralSaturation: 3,
    darkModeLuminosityScale: 6,
    darkModeSaturationBoost: 2,
    shadowTint: 'neutral',
    shadowOpacity: 0.25,
    pageBackgroundOpacity: 0.05,
    // A cool, subtle surface tint reads as refined rather than warm/cozy
    // (Workstream E1) — sophistication over comfort.
    surfaceHueBias: 'cool',
    surfaceSaturationShift: 3,
  },

  // Thin flourish lines: slender, rotated slivers evoking a hand-drawn
  // calligraphic flourish rather than a rigid grid.
  pageBackground: {
    pattern: `<svg width="50" height="50" xmlns="http://www.w3.org/2000/svg"><ellipse cx="25" cy="12" rx="20" ry="1" fill="currentColor" transform="rotate(-8 25 12)"/><ellipse cx="25" cy="38" rx="20" ry="1" fill="currentColor" transform="rotate(8 25 38)"/></svg>`,
    usePrimaryTint: false,
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
    shadowProfile: 'hard-offset' as PersonalityShadowProfile,
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
    surfaceLuminosityOffset: -5,
    foregroundContrast: 88,
    secondaryLuminosityOffset: 38,
    mutedLuminosityOffset: 52,
    neutralSaturation: 18,
    darkModeLuminosityScale: 10,
    darkModeSaturationBoost: 12,
    shadowTint: 'warm',
    shadowOpacity: 0.06,
    pageBackgroundOpacity: 0.05,
    // Flat, untinted raw paper (Workstream E1) — architect's surface carries
    // NO hue character at all, only a dramatic (brutalist) luminosity lift;
    // the identity is structural (hard-offset shadows, thick borders), not
    // chromatic.
    surfaceHueBias: 'none',
    surfaceSaturationShift: 0,
  },

  // Blueprint grid + crosshairs, untinted: thin filled rules (not
  // `<pattern>`-indirected, so the runtime fill substitution actually
  // controls their opacity) form a technical drafting grid with a small
  // crosshair registration mark.
  pageBackground: {
    pattern: `<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="24" height="0.5" fill="currentColor"/><rect x="0" y="0" width="0.5" height="24" fill="currentColor"/><rect x="11" y="9" width="2" height="0.5" fill="currentColor"/><rect x="11.75" y="8.25" width="0.5" height="2" fill="currentColor"/></svg>`,
    usePrimaryTint: false,
  },

  // Surface texture (Workstream C3): a very sparse blueprint cross-hatch —
  // wider tile and thinner rules than the page-background grid above, so the
  // card surface reads as "drafting paper under text" rather than repeating
  // the exact same motif at the same density on top of it.
  surfaceTexture: {
    pattern: `<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="40" height="0.5" fill="currentColor"/><rect x="0" y="0" width="0.5" height="40" fill="currentColor"/></svg>`,
    usePrimaryTint: false,
    opacity: 0.03,
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
 * Soft Touch personality - Warm Tactile Paper
 * Grounded, warm, tactile identity with a soft optical serif heading and
 * pill-shaped edges with real lift. Deliberately differentiated from `soft`
 * (airy/light/pastel) per Workstream B1 — `soft-touch` reads as "paper",
 * not a lighter-weight clone of `soft`.
 * Best for: Wellness apps, form-heavy UIs, educational content
 */
export const softTouchPersonality: Personality = {
  id: 'soft-touch',
  name: 'Soft Touch',
  description:
    'Warm tactile "paper" aesthetic - a soft optical serif heading, humanist sans body, pill-shaped edges, and tactile lift for wellness and form-heavy UIs.',
  version: '1.0.0',

  colorHarmony: {
    type: 'analogous' as ColorHarmonyType,
    saturationBoost: -0.25,
    lightnessShift: 0.08,
    accentSaturation: 40,
    accentLightness: 55,
    analogousSpread: 30,
  },

  contrast: {
    minimumRatio: 4.5,
    enhancedRatio: 7,
    backgroundOffset: 0.06,
    autoAdjust: true,
  },

  tokens: {
    spacingScale: 'comfortable' as SpacingScale,
    spacingMultiplier: 1.15,
    borderRadius: 'pill' as BorderRadiusStyle,
    // Capped at 1.25 (was 1.75): pill radii are already the most aggressive
    // style, and the compounded multiplier produced container radii large
    // enough to clip corner content. Pill identity lives in the style +
    // button/full radii, not in oversized surface radii.
    borderRadiusMultiplier: 1.25,
    borderStyle: 'thin' as BorderStyle,
    borderWidth: '1.5px',
    shadowIntensity: 'medium' as ShadowIntensity,
    shadowMultiplier: 1.1,
    shadowProfile: 'diffuse' as PersonalityShadowProfile,
    typography: 'friendly' as TypographyStyle,
    lineHeight: 1.6,
    letterSpacing: '0em',
  },

  fonts: {
    body: {
      family: '"Mulish", system-ui, sans-serif',
      weights: [400, 500, 600, 700],
      display: 'swap',
      preload: true,
    },
    heading: {
      family: '"Fraunces", Georgia, serif',
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
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    duration: {
      instant: '0ms',
      fast: '200ms',
      normal: '380ms',
      slow: '650ms',
    },
    staggerDelay: '80ms',
    prefersReducedMotion: true,
  },

  iconStyle: 'outlined' as IconStyle,

  colorGeneration: {
    backgroundLuminosity: 97,
    surfaceLuminosityOffset: -3,
    foregroundContrast: 90,
    secondaryLuminosityOffset: 42,
    mutedLuminosityOffset: 58,
    neutralSaturation: 18,
    darkModeLuminosityScale: 8,
    darkModeSaturationBoost: 9,
    shadowTint: 'warm',
    shadowOpacity: 0.14,
    pageBackgroundOpacity: 0.04,
    // Warm tactile "paper" surface (Workstream E1) — the strongest warm bias
    // in the set, matching its warm shadow tint and "grounded, warm,
    // tactile" identity.
    surfaceHueBias: 'warm',
    surfaceSaturationShift: 7,
  },

  // Paper-grain noise: a small irregular speckle field, evoking the
  // "warm tactile paper" identity without reading as a repeating grid.
  pageBackground: {
    pattern: `<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg"><circle cx="2" cy="3" r="0.4" fill="currentColor"/><circle cx="9" cy="6" r="0.5" fill="currentColor"/><circle cx="13" cy="2" r="0.3" fill="currentColor"/><circle cx="5" cy="11" r="0.4" fill="currentColor"/><circle cx="12" cy="13" r="0.5" fill="currentColor"/></svg>`,
    usePrimaryTint: false,
  },

  // Surface texture (Workstream C3): fine paper-grain speckle — a smaller,
  // denser tile than the page-background noise above, read up close on a
  // card surface as the same "warm tactile paper" identity carried onto the
  // element that actually holds text.
  surfaceTexture: {
    pattern: `<svg width="8" height="8" xmlns="http://www.w3.org/2000/svg"><circle cx="1" cy="1" r="0.3" fill="currentColor"/><circle cx="5" cy="3" r="0.25" fill="currentColor"/><circle cx="3" cy="6" r="0.3" fill="currentColor"/><circle cx="7" cy="7" r="0.25" fill="currentColor"/></svg>`,
    usePrimaryTint: false,
    opacity: 0.04,
  },

  mobile: {
    spacingMultiplier: 0.9,
    // Mobile surfaces are smaller, so radii clip sooner — no extra
    // amplification on top of the (already capped) base multiplier.
    borderRadiusMultiplier: 1.0,
    shadowReduction: 0.4,
    fontScale: 0.95,
    touchTargetSize: '48px',
  },

  tags: ['warm', 'tactile', 'paper', 'organic', 'wellness'],
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
    shadowProfile: 'neon' as PersonalityShadowProfile,
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
    surfaceLuminosityOffset: -6,
    foregroundContrast: 90,
    secondaryLuminosityOffset: 40,
    mutedLuminosityOffset: 55,
    neutralSaturation: 14,
    darkModeLuminosityScale: 7,
    darkModeSaturationBoost: 8,
    shadowTint: 'primary-tint',
    shadowOpacity: 0.1,
    pageBackgroundOpacity: 0.06,
    // A faint but clearly primary-tinted surface lift (Workstream E1) — the
    // strongest saturation shift in the set, matching electric's
    // primary-tinted shadow and "vibrant kinetic" identity.
    surfaceHueBias: 'primary',
    surfaceSaturationShift: 9,
  },

  // Angular circuit traces, primary-tinted: right-angle rules with small
  // pad circles at their ends, echoing the "vibrant kinetic" tech-social
  // brief (a PCB trace, not an organic line).
  pageBackground: {
    pattern: `<svg width="32" height="32" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="12" height="1.5" fill="currentColor"/><rect x="14.5" y="4" width="1.5" height="10" fill="currentColor"/><rect x="14.5" y="12.5" width="10" height="1.5" fill="currentColor"/><circle cx="4" cy="4.75" r="1.5" fill="currentColor"/><circle cx="24" cy="13.25" r="1.5" fill="currentColor"/></svg>`,
    usePrimaryTint: true,
  },

  // Surface texture (Workstream C3): a single faint angular accent tucked in
  // one corner of each tile — a small "circuit trace corner", not the full
  // multi-segment page-background trace, so a card reads as accented rather
  // than wallpapered. Primary-tinted like the page background, matching the
  // "vibrant kinetic" identity.
  surfaceTexture: {
    pattern: `<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="6" height="1" fill="currentColor"/><rect x="0" y="0" width="1" height="6" fill="currentColor"/></svg>`,
    usePrimaryTint: true,
    opacity: 0.04,
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
    shadowProfile: 'technical' as PersonalityShadowProfile,
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
    surfaceLuminosityOffset: -4,
    foregroundContrast: 92,
    secondaryLuminosityOffset: 38,
    mutedLuminosityOffset: 54,
    neutralSaturation: 6,
    darkModeLuminosityScale: 6,
    darkModeSaturationBoost: 4,
    shadowTint: 'cool',
    shadowOpacity: 0.12,
    pageBackgroundOpacity: 0.05,
    // A cool, technical instrument-panel surface (Workstream E1) — matches
    // its cool shadow tint and precise/technical identity.
    surfaceHueBias: 'cool',
    surfaceSaturationShift: 4,
  },

  // Fine 20x20 instrument-panel grid, authored as direct filled shapes with
  // NO `<defs>`/`<pattern>`/`url(#...)` indirection (carry-over fix from
  // Phase 5, Workstream E's Task 4): `generatePageBackgroundPattern`
  // (theme-lib) rewrites every `fill="..."` attribute wholesale to the
  // computed tint color, so a `<rect fill="url(#grid)"/>` referencing a
  // `<defs>` pattern gets its `fill` overwritten while the `<pattern>`
  // definition itself is left orphaned and unreferenced — the grid never
  // rendered, only a flat wash. Direct edge rules (top/left of each 20x20
  // tile) tile into the same visual grid density without any indirection,
  // plus a small center via/dot distinguishing it from architect's
  // crosshair-style blueprint grid.
  pageBackground: {
    pattern: `<svg width="20" height="20" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="20" height="0.6" fill="currentColor"/><rect x="0" y="0" width="0.6" height="20" fill="currentColor"/><rect x="9.5" y="9.5" width="1" height="1" fill="currentColor"/></svg>`,
    usePrimaryTint: false,
  },

  // Surface texture (Workstream C3): 1px horizontal scanlines on a ~4px
  // pitch — a CRT/monitor-panel texture distinct from the page-background's
  // instrument-panel grid, echoing the "technical dashboard" identity on the
  // element that actually holds readouts.
  surfaceTexture: {
    pattern: `<svg width="4" height="4" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="4" height="1" fill="currentColor"/></svg>`,
    usePrimaryTint: false,
    opacity: 0.03,
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
    borderStyle: 'none' as BorderStyle,
    borderWidth: '0px',
    shadowIntensity: 'none' as ShadowIntensity,
    shadowMultiplier: 0.5,
    shadowProfile: 'technical' as PersonalityShadowProfile,
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
    speed: 'instant' as AnimationSpeed,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    duration: {
      instant: '0ms',
      fast: '50ms',
      normal: '75ms',
      slow: '120ms',
    },
    staggerDelay: '10ms',
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
    // 0 opacity is intentional (not "not yet authored"): Foundation is the
    // base-infrastructure personality — maximum clarity with zero visual
    // noise is the point, so it stays without a `pageBackground` block.
    pageBackgroundOpacity: 0,
    // Barely lifts (Workstream E1, matches minimal's smallest offset) with
    // only a faint cool technical lean — Foundation's "maximum clarity,
    // zero visual noise" identity keeps this the most restrained tint in
    // the set alongside control-center's family.
    surfaceHueBias: 'cool',
    surfaceSaturationShift: 2,
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

/**
 * Derives the presentation typography font-family values from the personality's
 * canonical `fonts` block, so `--personality-font-family` (emitted from
 * `familyValue`) can never diverge from `--font-heading`/`--font-body`. This is
 * the single source of truth: edit `Personality.fonts`, not these values.
 */
function withDerivedFontFamilies(
  personality: Personality,
  presentation: PersonalityPresentation
): PersonalityPresentation {
  const headingFamily =
    personality.fonts.heading?.family ?? personality.fonts.body.family;
  const bodyFamily = personality.fonts.body.family;
  return {
    ...presentation,
    typography: {
      ...presentation.typography,
      familyValue: headingFamily,
      headingFamilyValue: headingFamily,
      bodyFamilyValue: bodyFamily,
    },
  };
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
        focusStyle:
          '0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent)',
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
        focusStyle:
          '0 0 0 4px color-mix(in srgb, var(--primary) 24%, transparent)',
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
        focusStyle:
          '0 0 0 3px color-mix(in srgb, var(--primary) 14%, transparent)',
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
      radiusValue: '2px',
    },
    shadow: { style: 'subtle', value: '0 1px 3px rgba(0,0,0,0.1)' },
    typography: {
      fontFamily: 'sans-serif',
      headingFamily: 'sans-serif',
      bodyFamily: 'sans-serif',
      fontWeight: 'medium',
      fontStyle: 'normal',
      weightValue: '500',
    },
    animation: {
      style: 'none',
      speed: 'fast',
      timingFunction: 'linear',
      duration: '0s',
      transition: 'none',
    },
    layout: { borderRadius: '2px', spacing: 'normal', maxWidth: '76rem' },
    components: {
      button: {
        borderRadius: '2px',
        padding: '10px 20px',
        fontWeight: '500',
        textTransform: 'none',
      },
      card: {
        borderRadius: '2px',
        padding: '16px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      },
      input: {
        borderRadius: '2px',
        borderWidth: '1px',
        focusStyle:
          '0 0 0 2px color-mix(in srgb, var(--primary) 18%, transparent)',
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
    // Was 'neon' — playful is assigned the 'playful-drop' shadow profile
    // (Workstream B2), not 'neon' (electric only). 'dramatic' is the nearest
    // existing PersonalityShadowStyle value consistent with a saturated,
    // pronounced drop shadow.
    shadow: { style: 'dramatic', value: '0 0 10px rgba(0,0,0,0.15)' },
    typography: {
      fontFamily: 'display',
      headingFamily: 'display',
      bodyFamily: 'display',
      fontWeight: 'bold',
      fontStyle: 'normal',
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
        focusStyle:
          '0 0 0 4px color-mix(in srgb, var(--primary) 24%, transparent)',
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
      weightValue: '400',
    },
    animation: {
      style: 'subtle',
      speed: 'slow',
      timingFunction: 'ease',
      duration: '0.4s',
      transition: 'all 0.4s ease',
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
        focusStyle:
          '0 0 0 2px color-mix(in srgb, var(--primary) 16%, transparent)',
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
        focusStyle:
          '0 0 0 2px color-mix(in srgb, var(--primary) 10%, transparent)',
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
        focusStyle:
          '0 0 0 3px color-mix(in srgb, var(--primary) 20%, transparent)',
      },
    },
  }),
  'soft-touch': createPresentation({
    border: {
      style: 'solid',
      width: 'thin',
      radius: 'pill',
      styleValue: 'solid',
      widthValue: '1.5px',
      // Generic element radius — bounded so arbitrary containers don't clip.
      // True pill (9999px) is reserved for buttons below, where single-line
      // padded labels can't be clipped by the rounding.
      radiusValue: '24px',
    },
    // 'glow' stays consistent with the assigned 'diffuse' shadow profile
    // (large blur, low opacity, warm tint) — no change needed here.
    shadow: { style: 'glow', value: '0 10px 26px rgba(0,0,0,0.14)' },
    typography: {
      fontFamily: 'serif',
      headingFamily: 'serif',
      bodyFamily: 'sans-serif',
      fontWeight: 'medium',
      fontStyle: 'normal',
      weightValue: '500',
    },
    animation: {
      style: 'subtle',
      speed: 'slow',
      timingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      duration: '0.35s',
      transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
    },
    layout: { borderRadius: '24px', spacing: 'relaxed', maxWidth: '72rem' },
    components: {
      button: {
        borderRadius: '9999px',
        padding: '12px 26px',
        fontWeight: '600',
        textTransform: 'none',
      },
      card: {
        borderRadius: '20px',
        padding: '24px',
        boxShadow: '0 12px 28px rgba(0,0,0,0.08)',
      },
      input: {
        borderRadius: '18px',
        borderWidth: '1.5px',
        focusStyle:
          '0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent)',
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
        focusStyle:
          '0 0 0 4px color-mix(in srgb, var(--primary) 28%, transparent)',
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
        focusStyle:
          '0 0 0 2px color-mix(in srgb, var(--primary) 22%, transparent)',
      },
    },
  }),
  foundation: createPresentation({
    border: {
      style: 'solid',
      width: 'thin',
      radius: 'none',
      styleValue: 'none',
      widthValue: '0px',
      radiusValue: '0px',
    },
    shadow: { style: 'none', value: 'none' },
    typography: {
      fontFamily: 'sans-serif',
      headingFamily: 'sans-serif',
      bodyFamily: 'sans-serif',
      fontWeight: 'medium',
      fontStyle: 'normal',
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
        focusStyle:
          '0 0 0 2px color-mix(in srgb, var(--primary) 12%, transparent)',
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
  presentation: withDerivedFontFamilies(
    personality,
    PRESENTATION_BY_ID[personality.id]
  ),
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
