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
  BorderStyle,
} from './personality.interfaces';
import { getPersonalityComposition } from './personality-composition';

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
    touchTargetSize: '44px',
  },

  tags: ['versatile', 'balanced', 'professional', 'default'],
  category: 'professional',
  isClassic: true,
  // Extension layer (rollout D1): white page, brand-washed surfaces and dark mode.
  expression: {
    ground: { light: 'white', dark: 'tinted' },
    accent: 'tinted-surfaces',
  },
  typeScale: {
    ratio: 1.25,
    headingWeight: 600,
    headingCase: 'none',
    headingTracking: '-0.01em',
    headingLineHeight: 1.2,
  },
  atmosphere: {
    backdrop: 'glow',
    surface: 'sheen',
    accentFill: 'linear',
    buttonFill: 'gradient',
    intensity: 0.8,
  },
  motion: { ambient: 'breathe', scenes: ['aurora-ribbon', 'glass-fog'] },
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
    touchTargetSize: '48px',
  },

  tags: ['clean', 'spacious', 'elegant', 'modern'],
  category: 'professional',
  // Extension layer (rollout D1): whitespace and type do the work.
  expression: {
    ground: { light: 'white', dark: 'dim' },
    accent: 'restrained',
    neutralBase: 'respect',
  },
  typeScale: {
    ratio: 1.333,
    headingWeight: 300,
    headingCase: 'none',
    headingTracking: '-0.025em',
    headingLineHeight: 1.1,
  },
  atmosphere: {
    backdrop: 'none',
    surface: 'flat',
    pagePattern: 'dots',
    intensity: 0.7,
  },
  motion: { glow: 'soft', scenes: ['glass-fog'] },
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
    touchTargetSize: '48px',
  },

  tags: ['vibrant', 'energetic', 'marketing', 'creative'],
  category: 'creative',
  // Extension layer (rollout D3).
  expression: {
    ground: { light: 'tinted', dark: 'ink' },
    accent: 'primary-ground',
  },
  typeScale: {
    ratio: 1.414,
    headingWeight: 800,
    headingCase: 'none',
    headingTracking: '-0.03em',
    headingLineHeight: 1.05,
  },
  atmosphere: {
    backdrop: 'sweep',
    surface: 'gradient',
    accentFill: 'linear',
    accentPattern: 'stripes',
    buttonFill: 'gradient',
    intensity: 1.3,
  },
  motion: { scenes: ['halftone-tide', 'shimmer-beam'] },
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
    touchTargetSize: '44px',
  },

  tags: ['gentle', 'airy', 'calming', 'wellness'],
  category: 'casual',
  // Extension layer (rollout D2).
  expression: {
    ground: { light: 'tinted', dark: 'tinted' },
    accent: 'tinted-surfaces',
  },
  typeScale: {
    ratio: 1.2,
    headingWeight: 600,
    headingCase: 'none',
    headingTracking: '0em',
    headingLineHeight: 1.25,
  },
  atmosphere: {
    backdrop: 'aurora',
    surface: 'glass',
    accentFill: 'mesh',
    buttonFill: 'gradient',
    intensity: 1,
  },
  motion: { scenes: ['canopy-dapple', 'glass-fog'] },
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
    touchTargetSize: '48px',
  },

  tags: ['enterprise', 'trustworthy', 'conservative', 'b2b'],
  category: 'professional',
  // Extension layer (rollout D1): grey app canvas, white cards, dense scale.
  expression: {
    ground: { light: 'toned', dark: 'dim' },
    accent: 'restrained',
    neutralBase: 'respect',
  },
  typeScale: {
    ratio: 1.2,
    headingWeight: 600,
    headingCase: 'none',
    headingTracking: '-0.005em',
    headingLineHeight: 1.25,
  },
  atmosphere: {
    backdrop: 'none',
    surface: 'sheen',
    pagePattern: 'grid',
    intensity: 0.6,
  },
  motion: { scenes: ['ledger-ticker', 'parallax-grid-warp'] },
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
    touchTargetSize: '56px',
  },

  tags: ['fun', 'energetic', 'creative', 'youth'],
  category: 'creative',
  // Extension layer (rollout D3).
  expression: {
    ground: { light: 'tinted', dark: 'tinted' },
    accent: 'duotone',
  },
  typeScale: {
    ratio: 1.333,
    headingWeight: 700,
    headingCase: 'none',
    headingTracking: '0em',
    headingLineHeight: 1.15,
  },
  atmosphere: {
    backdrop: 'mesh',
    surface: 'gradient',
    accentFill: 'mesh',
    accentPattern: 'dots',
    buttonFill: 'shine',
    intensity: 1.3,
  },
  motion: { ambient: 'shimmer', scenes: ['clay-blobs', 'halftone-tide'] },
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
    touchTargetSize: '44px',
  },

  tags: ['luxury', 'sophisticated', 'premium', 'refined'],
  category: 'professional',
  // Extension layer (rollout D2).
  expression: {
    ground: { light: 'paper', dark: 'black' },
    accent: 'restrained',
    neutralBase: 'respect',
  },
  typeScale: {
    ratio: 1.5,
    headingWeight: 400,
    headingCase: 'none',
    headingTracking: '0.005em',
    headingLineHeight: 1.1,
  },
  atmosphere: {
    backdrop: 'spotlight',
    surface: 'sheen',
    accentFill: 'radial',
    accentPattern: 'rings',
    intensity: 0.9,
  },
  motion: {
    enter: 'drift',
    ambient: 'shimmer',
    scenes: ['star-atlas', 'shimmer-beam'],
  },
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
    touchTargetSize: '44px',
  },

  tags: ['brutalist', 'industrial', 'structural', 'bold', 'technical'],
  category: 'technical',
  // Extension layer (rollout D3).
  expression: {
    ground: { light: 'toned', dark: 'black' },
    accent: 'primary-ground',
  },
  typeScale: {
    ratio: 1.333,
    headingWeight: 700,
    headingCase: 'uppercase',
    headingTracking: '0.02em',
    headingLineHeight: 1.05,
  },
  atmosphere: {
    backdrop: 'none',
    surface: 'flat',
    accentFill: 'split',
    accentPattern: 'diagonal',
    buttonFill: 'split',
    intensity: 1.1,
  },
  motion: {
    enter: 'snap',
    ambient: 'drift',
    scenes: ['blueprint-scan', 'grid-shift'],
  },
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
    // Mobile surfaces are smaller, so radii clip sooner — no extra
    // amplification on top of the (already capped) base multiplier.
    touchTargetSize: '48px',
  },

  tags: ['warm', 'tactile', 'paper', 'organic', 'wellness'],
  category: 'casual',
  // Extension layer (rollout D2).
  expression: {
    ground: { light: 'paper', dark: 'tinted' },
    accent: 'tinted-surfaces',
  },
  typeScale: {
    ratio: 1.25,
    headingWeight: 500,
    headingCase: 'none',
    headingTracking: '-0.01em',
    headingLineHeight: 1.15,
  },
  atmosphere: {
    backdrop: 'glow',
    surface: 'raised',
    accentFill: 'radial',
    buttonFill: 'gradient',
    intensity: 1,
  },
  motion: { scenes: ['canopy-dapple', 'clay-blobs'] },
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
      family: '"Sora", system-ui, sans-serif',
      weights: [600, 700],
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
    touchTargetSize: '48px',
  },

  tags: ['vibrant', 'energetic', 'kinetic', 'playful', 'social'],
  category: 'creative',
  // Extension layer (rollout D3).
  expression: { ground: { light: 'tinted', dark: 'ink' }, accent: 'duotone' },
  typeScale: {
    ratio: 1.414,
    headingWeight: 800,
    headingCase: 'none',
    headingTracking: '-0.025em',
    headingLineHeight: 1.05,
  },
  atmosphere: {
    backdrop: 'aurora',
    surface: 'glass',
    accentFill: 'mesh',
    accentPattern: 'diagonal',
    buttonFill: 'shine',
    intensity: 1.5,
  },
  motion: { scenes: ['neon-circuit', 'aurora-ribbon'] },
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
    touchTargetSize: '44px',
  },

  tags: ['technical', 'dashboard', 'monospace', 'grid', 'precision'],
  category: 'technical',
  // Extension layer (rollout D2).
  expression: {
    ground: { light: 'toned', dark: 'ink' },
    accent: 'restrained',
    neutralBase: 'respect',
  },
  typeScale: {
    ratio: 1.125,
    headingWeight: 600,
    headingCase: 'uppercase',
    headingTracking: '0.04em',
    headingLineHeight: 1.2,
  },
  atmosphere: {
    backdrop: 'horizon',
    surface: 'sheen',
    pagePattern: 'scanline',
    accentPattern: 'grid',
    intensity: 0.9,
  },
  motion: { scenes: ['signal-mesh', 'blueprint-scan'] },
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
      family: '"Public Sans", system-ui, sans-serif',
      weights: [400, 500, 600],
      display: 'swap',
      preload: true,
    },
    heading: {
      family: '"Public Sans", system-ui, sans-serif',
      weights: [500, 600, 700],
      display: 'swap',
      preload: true,
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
    touchTargetSize: '44px',
  },

  tags: ['minimal', 'functional', 'clean', 'utilitarian', 'base'],
  category: 'technical',
  // Extension layer (rollout D1): the flat, neutral baseline; no scene.
  expression: {
    ground: { light: 'white', dark: 'dim' },
    accent: 'restrained',
    neutralBase: 'respect',
  },
  typeScale: {
    ratio: 1.2,
    headingWeight: 500,
    headingCase: 'none',
    headingTracking: '-0.01em',
    headingLineHeight: 1.25,
  },
  atmosphere: { backdrop: 'none', surface: 'flat' },
  motion: { scenes: [] },
};

export const risographPersonality: Personality = {
  id: 'risograph',
  name: 'Risograph',
  description:
    'Two-ink print-zine aesthetic - misregistered offset shadows in a second ink, halftone dot fields, grainy stock, and punchy grotesque headlines.',
  version: '1.0.0',

  // Riso drums are loaded with a handful of fluorescent inks. Triadic puts
  // the tertiary 240deg from the primary, so the "second ink" (used for the
  // misregistration offsets below) is always a distinct drum colour — the
  // classic fluoro-pink + blue pairing with a pink primary.
  colorHarmony: {
    type: 'triadic',
    saturationBoost: 0.3,
    lightnessShift: 0.04,
    accentSaturation: 92,
    accentLightness: 56,
  },

  contrast: {
    minimumRatio: 4.5,
    autoAdjust: true,
  },

  tokens: {
    spacingScale: 'comfortable',
    spacingMultiplier: 1.05,
    borderRadius: 'sharp',
    borderRadiusMultiplier: 0.4,
    borderStyle: 'thick',
    borderWidth: '2.5px',
    shadowIntensity: 'dramatic',
    shadowMultiplier: 1.3,
    // Zero-blur offset is the literal look of a misregistered second pass.
    shadowProfile: 'hard-offset',
    typography: 'playful',
    lineHeight: 1.45,
    letterSpacing: '0.01em',
  },

  fonts: {
    heading: {
      family: '"Bricolage Grotesque", "Arial Narrow", sans-serif',
      weights: [600, 700, 800],
      display: 'swap',
      preload: true,
    },
    body: {
      family: '"Karla", system-ui, sans-serif',
      weights: [400, 500, 700],
      display: 'swap',
      preload: true,
    },
    mono: {
      family: '"Space Mono", monospace',
      weights: [400, 700],
      display: 'swap',
      preload: false,
    },
  },

  // A "thunk": fast, with a small overshoot like a drum pressing paper.
  animations: {
    speed: 'fast',
    easing: 'cubic-bezier(0.3, 1.4, 0.6, 1)',
    duration: {
      instant: '0ms',
      fast: '90ms',
      normal: '180ms',
      slow: '320ms',
    },
    staggerDelay: '40ms',
    prefersReducedMotion: false,
  },

  colorGeneration: {
    // Off-white newsprint rather than bright white.
    backgroundLuminosity: 96,
    surfaceLuminosityOffset: -4,
    foregroundContrast: 88,
    secondaryLuminosityOffset: 36,
    mutedLuminosityOffset: 52,
    neutralSaturation: 22,
    darkModeLuminosityScale: 9,
    darkModeSaturationBoost: 10,
    // Ink, not shadow: offsets carry the primary hue.
    shadowTint: 'primary-tint',
    shadowOpacity: 0.2,
    pageBackgroundOpacity: 0.06,
    // Uncoated stock leans warm regardless of the chosen ink.
    surfaceHueBias: 'warm',
    surfaceSaturationShift: 4,
  },

  // Halftone ramp: dot radius steps down across the tile so the page reads
  // as a screened gradient rather than a uniform polka dot. Primary-tinted,
  // like a light first pass of ink.
  pageBackground: {
    pattern: `<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg"><circle cx="3" cy="3" r="2" fill="currentColor"/><circle cx="15" cy="3" r="1.4" fill="currentColor"/><circle cx="9" cy="9" r="1.7" fill="currentColor"/><circle cx="21" cy="9" r="1" fill="currentColor"/><circle cx="3" cy="15" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="0.7" fill="currentColor"/><circle cx="9" cy="21" r="0.9" fill="currentColor"/><circle cx="21" cy="21" r="0.4" fill="currentColor"/></svg>`,
    usePrimaryTint: true,
  },

  // Surface texture: irregular ink specks — the stray toner flecks every riso
  // print carries. Square specks (not circles) so it can't be mistaken for
  // soft-touch's round paper grain.
  surfaceTexture: {
    pattern: `<svg width="10" height="10" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="2" width="0.6" height="0.6" fill="currentColor"/><rect x="6" y="1" width="0.4" height="0.4" fill="currentColor"/><rect x="4" y="5" width="0.7" height="0.5" fill="currentColor"/><rect x="8" y="7" width="0.5" height="0.6" fill="currentColor"/><rect x="2" y="8" width="0.4" height="0.4" fill="currentColor"/></svg>`,
    usePrimaryTint: true,
    opacity: 0.035,
  },

  mobile: {
    touchTargetSize: '46px',
  },

  tags: ['print', 'zine', 'halftone', 'two-ink', 'poster'],
  category: 'creative',
  // Extension layer (rollout D4).
  expression: { ground: { light: 'paper', dark: 'tinted' }, accent: 'duotone' },
  typeScale: {
    ratio: 1.414,
    headingWeight: 800,
    headingCase: 'uppercase',
    headingTracking: '-0.01em',
    headingLineHeight: 1.0,
  },
  atmosphere: {
    backdrop: 'none',
    surface: 'flat',
    accentFill: 'split',
    accentPattern: 'halftone',
    buttonFill: 'split',
    intensity: 1.3,
  },
  motion: { scenes: ['halftone-tide'] },
};

export const observatoryPersonality: Personality = {
  id: 'observatory',
  name: 'Observatory',
  description:
    'Celestial star-atlas aesthetic - ink-black skies, hairline coordinate rules, starlight glows on hover, and a slow, deliberate orbit of motion.',
  version: '1.0.0',

  // Twilight: analogous neighbours (blue -> violet) with pale, light
  // "starlight" accents rather than saturated ones. Note theme-lib's
  // generatePersonalityColors() does not forward `analogousSpread`, so the
  // rendered tertiary sits at the default 30deg; the authored 60 only
  // registers in the distinctiveness metric until that is wired upstream.
  colorHarmony: {
    type: 'analogous',
    saturationBoost: -0.1,
    lightnessShift: 0.12,
    accentSaturation: 58,
    accentLightness: 70,
    analogousSpread: 60,
  },

  // Built for long reading sessions in the dark: AAA text contrast.
  contrast: {
    minimumRatio: 7,
    autoAdjust: true,
  },

  tokens: {
    spacingScale: 'spacious',
    spacingMultiplier: 1.2,
    // Lens-like rounded corners.
    borderRadius: 'round',
    borderRadiusMultiplier: 0.9,
    borderStyle: 'hairline',
    borderWidth: '0.5px',
    shadowIntensity: 'subtle',
    shadowMultiplier: 0.8,
    // Primary-colour glow, not a drop: surfaces emit light.
    shadowProfile: 'neon',
    typography: 'elegant',
    lineHeight: 1.7,
    letterSpacing: '0.015em',
  },

  fonts: {
    heading: {
      family: '"Instrument Serif", Georgia, serif',
      weights: [400],
      display: 'swap',
      preload: true,
    },
    body: {
      family: '"Manrope", system-ui, sans-serif',
      weights: [300, 400, 500, 600],
      display: 'swap',
      preload: true,
    },
    mono: {
      family: '"Martian Mono", "JetBrains Mono", monospace',
      weights: [300, 400],
      display: 'swap',
      preload: false,
    },
  },

  // Orbital: long, strongly decelerating curves; nothing snaps.
  animations: {
    speed: 'deliberate',
    easing: 'cubic-bezier(0.33, 0, 0.1, 1)',
    duration: {
      instant: '0ms',
      fast: '240ms',
      normal: '520ms',
      slow: '900ms',
    },
    staggerDelay: '110ms',
    prefersReducedMotion: true,
  },

  colorGeneration: {
    // Light mode is a cool daylight atlas page; dark mode (the headline
    // mode) is nearly black with a deep indigo cast.
    backgroundLuminosity: 97,
    surfaceLuminosityOffset: -3,
    foregroundContrast: 93,
    secondaryLuminosityOffset: 34,
    mutedLuminosityOffset: 50,
    neutralSaturation: 14,
    darkModeLuminosityScale: 4,
    darkModeSaturationBoost: 22,
    shadowTint: 'cool',
    shadowOpacity: 0.12,
    pageBackgroundOpacity: 0.07,
    surfaceHueBias: 'cool',
    surfaceSaturationShift: 8,
  },

  // Star chart: stars of five magnitudes, one three-star constellation joined
  // by hairline slivers (fill-drawn polygons, not strokes, so the runtime
  // fill substitution controls them), and a coordinate reticle.
  pageBackground: {
    pattern: `<svg width="96" height="96" xmlns="http://www.w3.org/2000/svg"><circle cx="18" cy="24" r="1.2" fill="currentColor"/><circle cx="52" cy="40" r="0.9" fill="currentColor"/><circle cx="74" cy="18" r="1.5" fill="currentColor"/><polygon points="18,24 52,40 52,40.4 18,24.4" fill="currentColor"/><polygon points="52,40 74,18 74.35,18.3 52.35,40.3" fill="currentColor"/><circle cx="8" cy="70" r="0.5" fill="currentColor"/><circle cx="36" cy="82" r="0.8" fill="currentColor"/><circle cx="88" cy="62" r="0.6" fill="currentColor"/><circle cx="62" cy="88" r="0.4" fill="currentColor"/><circle cx="90" cy="90" r="0.3" fill="currentColor"/><circle cx="30" cy="6" r="0.35" fill="currentColor"/><rect x="79.5" y="72" width="0.4" height="5" fill="currentColor"/><rect x="77.2" y="74.3" width="5" height="0.4" fill="currentColor"/></svg>`,
    usePrimaryTint: true,
  },

  // No surface texture: surfaces are viewports (inset), and the sky is on the
  // page, not on the glass.

  mobile: {
    touchTargetSize: '48px',
  },

  tags: ['celestial', 'night', 'research', 'contemplative', 'data'],
  category: 'technical',
  // Extension layer (rollout D4).
  expression: { ground: { light: 'toned', dark: 'ink' }, accent: 'restrained' },
  typeScale: {
    ratio: 1.333,
    headingWeight: 400,
    headingCase: 'none',
    headingTracking: '0em',
    headingLineHeight: 1.15,
  },
  atmosphere: {
    backdrop: 'horizon',
    surface: 'glass',
    accentFill: 'radial',
    accentPattern: 'rings',
    intensity: 1.2,
  },
  motion: { scenes: ['star-atlas', 'topographic-drift', 'particle-veil'] },
};

export const ledgerPersonality: Personality = {
  id: 'ledger',
  name: 'Ledger',
  description:
    "Bookkeeper's ledger aesthetic - ruled green-bar paper, double-rule totals, a grotesque masthead over tabular serif figures, and a banker's quiet calm.",
  version: '1.0.0',

  // Two inks, like a real ledger: the primary and its complement (the red
  // used for negatives), both deep and desaturated. Lightness 24 is dark
  // enough that on-primary text clears the personality's own 7:1 floor for
  // any hue, so buttons are as auditable as body text.
  colorHarmony: {
    type: 'complementary',
    saturationBoost: -0.15,
    lightnessShift: -0.08,
    accentSaturation: 48,
    accentLightness: 24,
    complementDistance: 180,
  },

  // Auditable means legible: AAA everywhere.
  contrast: {
    minimumRatio: 7,
    autoAdjust: true,
  },

  tokens: {
    spacingScale: 'compact',
    spacingMultiplier: 0.9,
    borderRadius: 'sharp',
    borderRadiusMultiplier: 0.25,
    // Double rules are the ledger's signature (totals, column dividers).
    // 3px is the minimum width at which `double` renders two lines.
    borderStyle: 'double',
    borderWidth: '3px',
    shadowIntensity: 'none',
    shadowMultiplier: 0.5,
    // A crisp 1px ring at low alpha — a ruled edge, not a lift.
    shadowProfile: 'technical',
    typography: 'clean',
    lineHeight: 1.55,
    letterSpacing: '0.005em',
  },

  fonts: {
    heading: {
      family: '"Libre Franklin", "Franklin Gothic Medium", sans-serif',
      weights: [600, 700, 800],
      display: 'swap',
      preload: true,
    },
    body: {
      family: '"Source Serif 4", Georgia, serif',
      weights: [400, 500, 600],
      display: 'swap',
      preload: true,
    },
    mono: {
      family: '"DM Mono", monospace',
      weights: [400, 500],
      display: 'swap',
      preload: false,
    },
  },

  // Brisk and linear-ish: a pen stroke, no flourish.
  animations: {
    speed: 'fast',
    easing: 'cubic-bezier(0.2, 0, 0, 1)',
    duration: {
      instant: '0ms',
      fast: '80ms',
      normal: '140ms',
      slow: '220ms',
    },
    staggerDelay: '16ms',
    prefersReducedMotion: true,
  },

  colorGeneration: {
    backgroundLuminosity: 96,
    surfaceLuminosityOffset: -4,
    foregroundContrast: 91,
    secondaryLuminosityOffset: 36,
    mutedLuminosityOffset: 50,
    neutralSaturation: 12,
    darkModeLuminosityScale: 7,
    darkModeSaturationBoost: 6,
    shadowTint: 'neutral',
    shadowOpacity: 0.05,
    pageBackgroundOpacity: 0.05,
    // Green-bar paper follows the ink: the surface picks up the primary hue
    // (banker's green with the default ledger primary).
    surfaceHueBias: 'primary',
    surfaceSaturationShift: 10,
  },

  // Ledger ruling: a writing line every 24px and a double column rule every
  // 160px, so the page reads as columns of a journal.
  pageBackground: {
    pattern: `<svg width="160" height="24" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="23.5" width="160" height="0.5" fill="currentColor"/><rect x="0" y="0" width="0.5" height="24" fill="currentColor"/><rect x="2" y="0" width="0.5" height="24" fill="currentColor"/></svg>`,
    usePrimaryTint: true,
  },

  // Surface texture: continuous-form "green-bar" banding — alternating 24px
  // bands, the same rhythm as the page ruling, so rows of figures on a card
  // sit on alternating stripes.
  surfaceTexture: {
    pattern: `<svg width="8" height="48" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="8" height="24" fill="currentColor"/></svg>`,
    usePrimaryTint: true,
    opacity: 0.03,
  },

  mobile: {
    touchTargetSize: '44px',
  },

  tags: ['finance', 'ledger', 'tabular', 'auditable', 'serif'],
  category: 'professional',
  // Extension layer (rollout D4).
  expression: {
    ground: { light: 'paper', dark: 'black' },
    accent: 'tinted-surfaces',
    neutralBase: 'respect',
  },
  typeScale: {
    ratio: 1.2,
    headingWeight: 700,
    headingCase: 'uppercase',
    headingTracking: '0.04em',
    headingLineHeight: 1.2,
  },
  atmosphere: {
    backdrop: 'none',
    surface: 'flat',
    accentPattern: 'ledger',
    intensity: 1,
  },
  motion: { scenes: ['ledger-ticker'] },
};

export const kunsthallePersonality: Personality = {
  id: 'kunsthalle',
  name: 'Kunsthalle',
  description:
    'International Typographic Style - a visible modular grid, oversized tight grotesque headlines, flush-left rag, a single signal accent, and zero ornament.',
  version: '1.0.0',

  // One accent and its immediate neighbours only: a very tight analogous
  // spread keeps secondary/tertiary as tonal variants of the signal colour.
  colorHarmony: {
    type: 'analogous',
    saturationBoost: 0.2,
    lightnessShift: -0.02,
    accentSaturation: 80,
    accentLightness: 46,
    analogousSpread: 12,
  },

  // Body text is pure black on pure white (21:1) regardless; the AA floor is
  // what lets a true signal red carry white button text without being muddied
  // to brick to chase 7:1.
  contrast: {
    minimumRatio: 4.5,
    autoAdjust: true,
  },

  tokens: {
    spacingScale: 'comfortable',
    spacingMultiplier: 1.1,
    borderRadius: 'sharp',
    borderRadiusMultiplier: 0,
    // Heavy rules, used structurally (header bars, column dividers).
    borderStyle: 'thick',
    borderWidth: '2px',
    shadowIntensity: 'none',
    shadowMultiplier: 0.3,
    shadowProfile: 'minimal',
    typography: 'modern',
    // Tight leading and negative tracking: display-first typography.
    lineHeight: 1.3,
    letterSpacing: '-0.02em',
  },

  fonts: {
    heading: {
      family: '"Archivo", "Helvetica Neue", Arial, sans-serif',
      weights: [700, 800, 900],
      display: 'swap',
      preload: true,
    },
    body: {
      family: '"Inter Tight", "Helvetica Neue", Arial, sans-serif',
      weights: [400, 500, 600],
      display: 'swap',
      preload: true,
    },
    mono: {
      family: '"Roboto Mono", monospace',
      weights: [400, 500],
      display: 'swap',
      preload: false,
    },
  },

  // A hard in-out slide: things move decisively from one column to the next.
  animations: {
    speed: 'fast',
    easing: 'cubic-bezier(0.7, 0, 0.3, 1)',
    duration: {
      instant: '0ms',
      fast: '120ms',
      normal: '220ms',
      slow: '400ms',
    },
    staggerDelay: '60ms',
    prefersReducedMotion: false,
  },

  // Solid pictograms, Aicher-style.

  colorGeneration: {
    // Pure white paper, pure black type.
    backgroundLuminosity: 100,
    surfaceLuminosityOffset: -6,
    foregroundContrast: 100,
    secondaryLuminosityOffset: 30,
    mutedLuminosityOffset: 48,
    neutralSaturation: 0,
    darkModeLuminosityScale: 3,
    darkModeSaturationBoost: 0,
    shadowTint: 'neutral',
    // Zero: the `minimal` profile collapses to no shadow at all.
    shadowOpacity: 0,
    pageBackgroundOpacity: 0.05,
    surfaceHueBias: 'none',
    surfaceSaturationShift: 0,
  },

  // The grid, made visible: a column rule and a gutter rule every 96px, with
  // short baseline ticks at the column edge every 8px.
  pageBackground: {
    pattern: `<svg width="96" height="8" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="0.75" height="8" fill="currentColor"/><rect x="80" y="0" width="0.75" height="8" fill="currentColor"/><rect x="0" y="0" width="3" height="0.5" fill="currentColor"/></svg>`,
    usePrimaryTint: false,
  },

  mobile: {
    touchTargetSize: '44px',
  },

  tags: ['swiss', 'grid', 'editorial', 'typographic', 'gallery'],
  category: 'creative',
  // Extension layer (rollout D4).
  expression: {
    ground: { light: 'white', dark: 'black' },
    accent: 'primary-ground',
    neutralBase: 'respect',
  },
  typeScale: {
    ratio: 1.5,
    headingWeight: 800,
    headingCase: 'none',
    headingTracking: '-0.035em',
    headingLineHeight: 0.95,
  },
  atmosphere: {
    backdrop: 'none',
    surface: 'flat',
    accentFill: 'split',
    buttonFill: 'split',
    intensity: 1.2,
  },
  motion: { enter: 'slide', scenes: ['grid-shift'] },
};

export const canopyPersonality: Personality = {
  id: 'canopy',
  name: 'Canopy',
  description:
    'Optimistic solarpunk greenhouse - sun-warmed leafy tints, generous rounded pods, dappled-light gradients, and growth-inspired easing.',
  version: '1.0.0',

  // Leaf, sun and sky: three evenly spaced hues, moderately saturated.
  colorHarmony: {
    type: 'triadic',
    saturationBoost: 0.1,
    lightnessShift: 0.06,
    accentSaturation: 62,
    accentLightness: 52,
  },

  contrast: {
    minimumRatio: 4.5,
    autoAdjust: true,
  },

  tokens: {
    spacingScale: 'airy',
    spacingMultiplier: 1.3,
    borderRadius: 'round',
    borderRadiusMultiplier: 1.35,
    borderStyle: 'thin',
    borderWidth: '1px',
    shadowIntensity: 'medium',
    shadowMultiplier: 1,
    shadowProfile: 'layered',
    typography: 'friendly',
    lineHeight: 1.65,
    letterSpacing: '0.005em',
  },

  fonts: {
    heading: {
      family: '"Young Serif", Georgia, serif',
      weights: [400],
      display: 'swap',
      preload: true,
    },
    body: {
      family: '"Figtree", system-ui, sans-serif',
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

  // Growth: a gentle overshoot, like a shoot springing up, never a bounce.
  animations: {
    speed: 'slow',
    easing: 'cubic-bezier(0.34, 1.3, 0.64, 1)',
    duration: {
      instant: '0ms',
      fast: '220ms',
      normal: '420ms',
      slow: '720ms',
    },
    staggerDelay: '90ms',
    prefersReducedMotion: true,
  },

  // Duotone leaves.

  colorGeneration: {
    backgroundLuminosity: 97,
    surfaceLuminosityOffset: -3,
    foregroundContrast: 89,
    secondaryLuminosityOffset: 40,
    mutedLuminosityOffset: 55,
    neutralSaturation: 20,
    darkModeLuminosityScale: 9,
    darkModeSaturationBoost: 14,
    // Shadows are cast by leaves: tinted, never grey.
    shadowTint: 'primary-tint',
    shadowOpacity: 0.13,
    pageBackgroundOpacity: 0.06,
    surfaceHueBias: 'primary',
    surfaceSaturationShift: 9,
  },

  // Scattered leaves on a vine plus a few seeds; primary-tinted.
  pageBackground: {
    pattern: `<svg width="64" height="64" xmlns="http://www.w3.org/2000/svg"><ellipse cx="16" cy="18" rx="7" ry="2.8" transform="rotate(-35 16 18)" fill="currentColor"/><ellipse cx="24" cy="12" rx="5" ry="2" transform="rotate(20 24 12)" fill="currentColor"/><ellipse cx="46" cy="44" rx="6.5" ry="2.6" transform="rotate(30 46 44)" fill="currentColor"/><circle cx="52" cy="14" r="1.1" fill="currentColor"/><circle cx="10" cy="50" r="0.9" fill="currentColor"/><circle cx="34" cy="56" r="0.6" fill="currentColor"/></svg>`,
    usePrimaryTint: true,
  },

  mobile: {
    touchTargetSize: '48px',
  },

  tags: ['solarpunk', 'organic', 'community', 'optimistic', 'greenhouse'],
  category: 'casual',
  // Extension layer (rollout D4).
  expression: {
    ground: { light: 'tinted', dark: 'tinted' },
    accent: 'tinted-surfaces',
  },
  typeScale: {
    ratio: 1.333,
    headingWeight: 400,
    headingCase: 'none',
    headingTracking: '0em',
    headingLineHeight: 1.1,
  },
  atmosphere: {
    backdrop: 'aurora',
    surface: 'gradient',
    accentFill: 'radial',
    accentPattern: 'waves',
    buttonFill: 'gradient',
    intensity: 1.1,
  },
  motion: { scenes: ['canopy-dapple', 'flock-field'] },
};

export const clayPersonality: Personality = {
  id: 'clay',
  name: 'Clay',
  description:
    'Tactile claymorphism - puffy, pressable pods with inner highlights and soft outer drops, chunky rounded display type, and squishy spring motion.',
  version: '1.0.0',

  // Pastel but not washed out: split-complementary gives two candy-like
  // companions to the primary.
  colorHarmony: {
    type: 'split-complementary',
    saturationBoost: 0.05,
    lightnessShift: 0.14,
    accentSaturation: 70,
    accentLightness: 66,
    complementDistance: 150,
  },

  contrast: {
    minimumRatio: 4.5,
    autoAdjust: true,
  },

  tokens: {
    spacingScale: 'comfortable',
    spacingMultiplier: 1.1,
    borderRadius: 'round',
    borderRadiusMultiplier: 1.6,
    // No outlines: shape is carried entirely by light and shade.
    borderStyle: 'none',
    borderWidth: '0px',
    shadowIntensity: 'dramatic',
    shadowMultiplier: 1.3,
    // A pronounced vertical drop — the pod sits on the table.
    shadowProfile: 'playful-drop',
    typography: 'playful',
    lineHeight: 1.55,
    letterSpacing: '0em',
  },

  fonts: {
    heading: {
      family: '"Unbounded", system-ui, sans-serif',
      weights: [500, 700],
      display: 'swap',
      preload: true,
    },
    body: {
      family: '"Plus Jakarta Sans", system-ui, sans-serif',
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

  // Squish: a strong spring overshoot on release.
  animations: {
    speed: 'normal',
    easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.6)',
    duration: {
      instant: '0ms',
      fast: '160ms',
      normal: '320ms',
      slow: '520ms',
    },
    staggerDelay: '60ms',
    prefersReducedMotion: false,
  },

  colorGeneration: {
    // A tinted, slightly dim "clay table" background so the lighter pods pop.
    backgroundLuminosity: 94,
    surfaceLuminosityOffset: -2,
    foregroundContrast: 86,
    secondaryLuminosityOffset: 36,
    mutedLuminosityOffset: 50,
    neutralSaturation: 28,
    // Dark clay, not black.
    darkModeLuminosityScale: 12,
    darkModeSaturationBoost: 8,
    shadowTint: 'primary-tint',
    shadowOpacity: 0.18,
    pageBackgroundOpacity: 0.05,
    surfaceHueBias: 'primary',
    surfaceSaturationShift: 5,
  },

  // Loose pebbles of clay scattered across the table.
  pageBackground: {
    pattern: `<svg width="72" height="72" xmlns="http://www.w3.org/2000/svg"><ellipse cx="18" cy="20" rx="7" ry="5.5" fill="currentColor"/><ellipse cx="52" cy="50" rx="9" ry="7" fill="currentColor"/><circle cx="58" cy="14" r="3" fill="currentColor"/><circle cx="14" cy="56" r="2" fill="currentColor"/></svg>`,
    usePrimaryTint: true,
  },

  // No surface texture: clay is smooth. Its tactility is in the shading.

  mobile: {
    // Chunky, thumb-friendly pods.
    touchTargetSize: '52px',
  },

  tags: ['claymorphism', 'tactile', '3d', 'friendly', 'family'],
  category: 'casual',
  // Extension layer (rollout D4).
  expression: {
    ground: { light: 'toned', dark: 'dim' },
    accent: 'tinted-surfaces',
  },
  typeScale: {
    ratio: 1.25,
    headingWeight: 700,
    headingCase: 'none',
    headingTracking: '-0.01em',
    headingLineHeight: 1.1,
  },
  atmosphere: {
    backdrop: 'glow',
    surface: 'raised',
    accentFill: 'radial',
    pagePattern: 'dots',
    buttonFill: 'shine',
    intensity: 1.1,
  },
  motion: { ambient: 'breathe', scenes: ['clay-blobs', 'pulse-rings'] },
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

const SECOND_INK = 'color-mix(in srgb, var(--tertiary) 82%, var(--foreground))';

const CLAY_INNER =
  'inset 3px 3px 6px color-mix(in srgb, white 45%, transparent), inset -4px -4px 8px color-mix(in srgb, var(--shadow-color, #000) 12%, transparent)';

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
    interaction: {
      hoverTransform: 'translateY(-4px) scale(1.02)',
      hoverShadow:
        '0 15px 35px color-mix(in srgb, var(--shadow-color, #000) 15%, transparent)',
      activeTransform: 'translateY(0) scale(0.98)',
    },
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
          '0 0 0 4px color-mix(in srgb, var(--primary) 30%, transparent)',
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
          '0 2px 8px color-mix(in srgb, var(--primary) 20%, transparent)',
      },
    },
  }),
  minimal: createPresentation({
    interaction: {
      hoverTransform: 'translateY(-2px)',
      hoverShadow: 'var(--shadow-md)',
    },
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
        focusStyle: '0 0 0 3px var(--background), 0 0 0 4px var(--primary)',
      },
    },
  }),
  architect: createPresentation({
    interaction: {
      hoverTransform: 'translate(-2px, -2px)',
      hoverShadow: '4px 4px 0 var(--primary)',
      activeTransform: 'translate(0, 0)',
      activeShadow: '2px 2px 0 var(--primary)',
      accentBorder: '2px solid var(--foreground)',
    },
    label: {
      fontFamily: 'var(--font-mono)',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    },
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
        focusStyle: '4px 4px 0 var(--primary)',
      },
    },
  }),
  'soft-touch': createPresentation({
    interaction: {
      hoverTransform: 'translateY(-3px)',
      hoverShadow:
        '0 12px 24px color-mix(in srgb, var(--shadow-color, #000) 12%, transparent)',
    },
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
          '0 0 0 4px color-mix(in srgb, var(--primary) 15%, transparent)',
      },
    },
  }),
  electric: createPresentation({
    interaction: {
      hoverTransform: 'translateY(-2px)',
      hoverShadow:
        '0 0 20px color-mix(in srgb, var(--primary) 45%, transparent)',
      accentBorder: '2px solid var(--primary)',
    },
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
      headingFamily: 'sans-serif',
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
        textTransform: 'none',
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
          '0 0 20px color-mix(in srgb, var(--primary) 40%, transparent)',
      },
    },
  }),
  'control-center': createPresentation({
    interaction: {
      hoverTransform: 'translateY(-1px)',
      hoverShadow: 'inset 0 0 0 1px var(--primary)',
      activeShadow:
        'inset 0 2px 4px color-mix(in srgb, var(--shadow-color, #000) 20%, transparent)',
      accentBorder: '1px solid var(--primary)',
    },
    label: {
      fontFamily: 'var(--font-mono)',
    },
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
          'inset 0 2px 4px color-mix(in srgb, var(--primary) 10%, transparent)',
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
  risograph: createPresentation({
    interaction: {
      // Lift off the page with a slight skew, exposing the second ink.
      hoverTransform: 'translate(-1px, -2px) rotate(-0.4deg)',
      hoverShadow: `4px 4px 0 ${SECOND_INK}, -1px -1px 0 color-mix(in srgb, var(--primary) 45%, transparent)`,
      // Stamp back down onto the paper.
      activeTransform: 'translate(2px, 2px)',
      activeShadow: `1px 1px 0 ${SECOND_INK}`,
      accentBorder: '2.5px solid var(--primary)',
    },
    label: {
      fontFamily: 'var(--font-mono)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
    },
    border: {
      style: 'solid',
      width: 'thick',
      radius: 'small',
      styleValue: 'solid',
      widthValue: '2.5px',
      radiusValue: '2px',
    },
    shadow: { style: 'dramatic', value: '4px 4px 0px rgba(0,0,0,0.22)' },
    typography: {
      fontFamily: 'display',
      headingFamily: 'display',
      bodyFamily: 'sans-serif',
      fontWeight: 'extrabold',
      fontStyle: 'normal',
      weightValue: '800',
    },
    animation: {
      style: 'wobbly',
      speed: 'fast',
      timingFunction: 'cubic-bezier(0.3, 1.4, 0.6, 1)',
      duration: '0.18s',
      transition: 'all 0.18s cubic-bezier(0.3, 1.4, 0.6, 1)',
    },
    layout: { borderRadius: '2px', spacing: 'normal', maxWidth: '70rem' },
    components: {
      button: {
        borderRadius: '2px',
        padding: '12px 22px',
        fontWeight: '800',
        textTransform: 'uppercase',
      },
      card: {
        borderRadius: '2px',
        padding: '22px',
        boxShadow: `6px 6px 0 ${SECOND_INK}`,
      },
      input: {
        borderRadius: '2px',
        borderWidth: '2.5px',
        focusStyle: `3px 3px 0 ${SECOND_INK}`,
      },
    },
  }),
  observatory: createPresentation({
    interaction: {
      // No movement on hover — stars don't jump. Light comes up instead.
      hoverShadow:
        '0 0 0 1px color-mix(in srgb, var(--primary) 60%, transparent), 0 0 28px color-mix(in srgb, var(--primary) 30%, transparent)',
      activeShadow:
        '0 0 0 1px var(--primary), 0 0 12px color-mix(in srgb, var(--primary) 45%, transparent)',
      accentBorder:
        '1px solid color-mix(in srgb, var(--primary) 55%, var(--border))',
    },
    label: {
      fontFamily: 'var(--font-mono)',
      textTransform: 'uppercase',
      letterSpacing: '0.18em',
    },
    border: {
      style: 'solid',
      width: 'thin',
      radius: 'large',
      styleValue: 'solid',
      widthValue: '1px',
      radiusValue: '14px',
    },
    // Static fallback only (the rendered glow is the `neon` profile, built from
    // the primary by ThemeService) — kept neutral like the other presets.
    shadow: { style: 'glow', value: '0 0 24px rgba(0,0,0,0.18)' },
    typography: {
      fontFamily: 'serif',
      headingFamily: 'serif',
      bodyFamily: 'sans-serif',
      fontWeight: 'light',
      fontStyle: 'normal',
      weightValue: '300',
    },
    animation: {
      style: 'flowing',
      speed: 'slow',
      timingFunction: 'cubic-bezier(0.33, 0, 0.1, 1)',
      duration: '0.52s',
      transition: 'all 0.52s cubic-bezier(0.33, 0, 0.1, 1)',
    },
    // A reading measure, not a dashboard width.
    layout: { borderRadius: '14px', spacing: 'relaxed', maxWidth: '66rem' },
    components: {
      button: {
        borderRadius: '9999px',
        padding: '11px 26px',
        fontWeight: '500',
        textTransform: 'none',
      },
      card: {
        borderRadius: '16px',
        padding: '28px',
        boxShadow: '0 0 32px rgba(0,0,0,0.14)',
      },
      input: {
        borderRadius: '10px',
        borderWidth: '1px',
        focusStyle:
          '0 0 0 1px var(--primary), 0 0 18px color-mix(in srgb, var(--primary) 35%, transparent)',
      },
    },
  }),
  ledger: createPresentation({
    interaction: {
      // A margin tick in the primary ink marks the row you're on.
      hoverShadow: 'inset 3px 0 0 var(--primary)',
      activeShadow: 'inset 0 0 0 1px var(--primary)',
      accentBorder: '3px double var(--foreground)',
    },
    label: {
      fontFamily: 'var(--font-heading)',
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
    },
    border: {
      style: 'double',
      width: 'thick',
      radius: 'none',
      styleValue: 'double',
      widthValue: '3px',
      radiusValue: '0px',
    },
    shadow: { style: 'none', value: 'none' },
    typography: {
      fontFamily: 'sans-serif',
      headingFamily: 'sans-serif',
      bodyFamily: 'serif',
      fontWeight: 'semibold',
      fontStyle: 'normal',
      weightValue: '600',
    },
    animation: {
      style: 'subtle',
      speed: 'fast',
      timingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
      duration: '0.14s',
      transition: 'all 0.14s cubic-bezier(0.2, 0, 0, 1)',
    },
    layout: { borderRadius: '0px', spacing: 'compact', maxWidth: '82rem' },
    components: {
      button: {
        borderRadius: '0px',
        padding: '8px 16px',
        fontWeight: '600',
        textTransform: 'uppercase',
      },
      card: {
        borderRadius: '0px',
        padding: '16px',
        boxShadow: 'none',
      },
      input: {
        borderRadius: '0px',
        borderWidth: '1px',
        // Focus writes on the line: an underline, not a ring.
        focusStyle: 'inset 0 -2px 0 var(--primary)',
      },
    },
  }),
  kunsthalle: createPresentation({
    interaction: {
      // Slide along the grid; a signal rule appears at the flush-left edge.
      hoverTransform: 'translateX(4px)',
      hoverShadow: 'inset 4px 0 0 var(--primary)',
      activeTransform: 'translateX(2px)',
      activeShadow: 'inset 6px 0 0 var(--primary)',
      accentBorder: '4px solid var(--primary)',
    },
    label: {
      fontFamily: 'var(--font-body)',
      textTransform: 'lowercase',
      letterSpacing: '-0.01em',
    },
    border: {
      style: 'solid',
      width: 'medium',
      radius: 'none',
      styleValue: 'solid',
      widthValue: '2px',
      radiusValue: '0px',
    },
    shadow: { style: 'none', value: 'none' },
    typography: {
      fontFamily: 'sans-serif',
      headingFamily: 'sans-serif',
      bodyFamily: 'sans-serif',
      fontWeight: 'bold',
      fontStyle: 'normal',
      weightValue: '700',
    },
    animation: {
      style: 'subtle',
      speed: 'fast',
      timingFunction: 'cubic-bezier(0.7, 0, 0.3, 1)',
      duration: '0.22s',
      transition: 'all 0.22s cubic-bezier(0.7, 0, 0.3, 1)',
    },
    // A wide 12-column canvas.
    layout: { borderRadius: '0px', spacing: 'normal', maxWidth: '90rem' },
    components: {
      button: {
        borderRadius: '0px',
        padding: '14px 28px',
        fontWeight: '700',
        textTransform: 'lowercase',
      },
      card: {
        borderRadius: '0px',
        padding: '24px',
        boxShadow: 'none',
      },
      input: {
        borderRadius: '0px',
        borderWidth: '2px',
        focusStyle: '0 0 0 2px var(--foreground)',
      },
    },
  }),
  canopy: createPresentation({
    interaction: {
      // Rise toward the light, casting a longer leaf-tinted shadow.
      hoverTransform: 'translateY(-3px) scale(1.01)',
      hoverShadow:
        '0 14px 28px -10px color-mix(in srgb, var(--primary) 35%, transparent)',
      activeTransform: 'translateY(-1px) scale(0.995)',
      accentBorder:
        '1px solid color-mix(in srgb, var(--primary) 40%, var(--border))',
    },
    border: {
      style: 'solid',
      width: 'thin',
      radius: 'large',
      styleValue: 'solid',
      widthValue: '1px',
      radiusValue: '20px',
    },
    shadow: { style: 'medium', value: '0 8px 20px -6px rgba(0,0,0,0.14)' },
    typography: {
      fontFamily: 'serif',
      headingFamily: 'serif',
      bodyFamily: 'sans-serif',
      fontWeight: 'normal',
      fontStyle: 'normal',
      weightValue: '400',
    },
    animation: {
      style: 'bouncy',
      speed: 'slow',
      timingFunction: 'cubic-bezier(0.34, 1.3, 0.64, 1)',
      duration: '0.42s',
      transition: 'all 0.42s cubic-bezier(0.34, 1.3, 0.64, 1)',
    },
    layout: { borderRadius: '20px', spacing: 'relaxed', maxWidth: '72rem' },
    components: {
      button: {
        borderRadius: '9999px',
        padding: '13px 28px',
        fontWeight: '600',
        textTransform: 'none',
      },
      card: {
        borderRadius: '22px',
        padding: '26px',
        boxShadow: '0 10px 24px -8px rgba(0,0,0,0.14)',
      },
      input: {
        borderRadius: '14px',
        borderWidth: '1px',
        // Focus blooms in the tertiary ("sky") hue.
        focusStyle:
          '0 0 0 4px color-mix(in srgb, var(--tertiary) 25%, transparent)',
      },
    },
  }),
  clay: createPresentation({
    interaction: {
      hoverTransform: 'translateY(-2px) scale(1.015)',
      hoverShadow: `${CLAY_INNER}, 0 16px 28px -8px color-mix(in srgb, var(--shadow-color, #000) 28%, transparent)`,
      // Pressed: squashes and the moulding inverts (pushed into the clay).
      activeTransform: 'translateY(1px) scale(0.97)',
      activeShadow:
        'inset 4px 4px 10px color-mix(in srgb, var(--shadow-color, #000) 22%, transparent), inset -3px -3px 8px color-mix(in srgb, white 20%, transparent)',
    },
    border: {
      style: 'solid',
      width: 'thin',
      radius: 'large',
      styleValue: 'none',
      widthValue: '0px',
      radiusValue: '28px',
    },
    shadow: {
      style: 'dramatic',
      value: `${CLAY_INNER}, 0 12px 24px -6px rgba(0,0,0,0.18)`,
    },
    typography: {
      fontFamily: 'display',
      headingFamily: 'display',
      bodyFamily: 'sans-serif',
      fontWeight: 'semibold',
      fontStyle: 'normal',
      weightValue: '600',
    },
    animation: {
      style: 'bouncy',
      speed: 'normal',
      timingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.6)',
      duration: '0.32s',
      transition: 'all 0.32s cubic-bezier(0.175, 0.885, 0.32, 1.6)',
    },
    layout: { borderRadius: '28px', spacing: 'relaxed', maxWidth: '68rem' },
    components: {
      button: {
        borderRadius: '9999px',
        padding: '14px 30px',
        fontWeight: '700',
        textTransform: 'none',
      },
      card: {
        borderRadius: '32px',
        padding: '28px',
        boxShadow: `${CLAY_INNER}, 0 14px 28px -8px rgba(0,0,0,0.16)`,
      },
      input: {
        borderRadius: '20px',
        borderWidth: '0px',
        // Inputs are wells pressed into the clay; focus adds a soft ring.
        focusStyle:
          'inset 3px 3px 6px color-mix(in srgb, var(--shadow-color, #000) 14%, transparent), inset -3px -3px 6px color-mix(in srgb, white 35%, transparent), 0 0 0 3px color-mix(in srgb, var(--primary) 35%, transparent)',
      },
    },
  }),
};

/**
 * All predefined personalities (18 total: 7 original + 5 library-promoted + 6 playground)
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
  risographPersonality,
  observatoryPersonality,
  ledgerPersonality,
  kunsthallePersonality,
  canopyPersonality,
  clayPersonality,
].map((personality) => ({
  ...personality,
  presentation: {
    ...withDerivedFontFamilies(personality, PRESENTATION_BY_ID[personality.id]),
    composition: getPersonalityComposition(personality.id),
  },
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
