/**
 * Library-specific personality configurations
 * Each library gets a distinct visual personality that's immediately recognizable
 *
 * @deprecated Use personalities.ts instead. These library personalities are now
 * integrated into the main personality system as application-level personalities:
 * - architect → architectPersonality
 * - soft-touch → softTouchPersonality
 * - electric → electricPersonality
 * - control-center → controlCenterPersonality
 * - foundation → foundationPersonality
 *
 * This file is kept for backward compatibility only.
 */

export type LibraryPersonalityId =
  | 'architect' // common-ui: Brutalist Industrial
  | 'soft-touch' // form-ui: Organic Warm
  | 'electric' // social-ui: Vibrant Kinetic
  | 'control-center' // theme-ui: Technical Dashboard
  | 'foundation'; // theme-lib: Base infrastructure

export interface LibraryShadowConfig {
  small: string;
  medium: string;
  large: string;
  glow: string;
}

export interface LibraryBorderConfig {
  width: string;
  style: 'solid' | 'dashed' | 'dotted' | 'double';
  radius: string;
}

export interface LibraryGradientConfig {
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
}

export interface LibraryAnimationConfig {
  duration: {
    instant: string;
    fast: string;
    normal: string;
    slow: string;
  };
  easing: string;
}

export interface LibraryFontConfig {
  heading: string;
  body: string;
  mono: string;
}

export interface LibraryPersonality {
  id: LibraryPersonalityId;
  name: string;
  description: string;

  fonts: LibraryFontConfig;

  shadows: LibraryShadowConfig;
  borders: LibraryBorderConfig;

  gradients: LibraryGradientConfig;
  animations: LibraryAnimationConfig;

  // Special styling rules
  useHardShadows: boolean;
  useDiagonalGradients: boolean;
  useGlowEffects: boolean;
  useDottedBorders: boolean;
  usePillShape: boolean;
  useInsetShadows: boolean;
  useGridBackground: boolean;

  // Color interpretation overrides
  interpretPalette: (
    accent: string,
    complement: string
  ) => {
    accentAdjustment: number;
    complementAdjustment: number;
  };
}

/**
 * Architect Personality - Brutalist Industrial
 * Raw, structural, bold - for common-ui
 */
export const architectPersonality: LibraryPersonality = {
  id: 'architect',
  name: 'Architect',
  description: 'Brutalist industrial aesthetic - raw, structural, bold',

  fonts: {
    heading: '"Oswald", "Impact", sans-serif',
    body: '"IBM Plex Mono", "Courier New", monospace',
    mono: '"IBM Plex Mono", monospace',
  },

  shadows: {
    small: '2px 2px 0 var(--accent)',
    medium: '4px 4px 0 var(--accent)',
    large: '8px 8px 0 var(--accent)',
    glow: '0 0 0 var(--accent)',
  },

  borders: {
    width: '3px',
    style: 'solid',
    radius: '0px',
  },

  gradients: {
    primary:
      'linear-gradient(135deg, var(--accent) 25%, var(--complement) 25%, var(--complement) 50%, var(--accent) 50%, var(--accent) 75%, var(--complement) 75%)',
    secondary:
      'linear-gradient(45deg, var(--accent) 0%, transparent 50%, var(--complement) 100%)',
    accent: 'linear-gradient(90deg, var(--accent) 0%, var(--complement) 100%)',
    surface:
      'linear-gradient(180deg, var(--background) 0%, var(--surface) 100%)',
  },

  animations: {
    duration: {
      instant: '0ms',
      fast: '50ms',
      normal: '100ms',
      slow: '200ms',
    },
    easing: 'steps(2, end)',
  },

  useHardShadows: true,
  useDiagonalGradients: true,
  useGlowEffects: false,
  useDottedBorders: false,
  usePillShape: false,
  useInsetShadows: false,
  useGridBackground: false,

  interpretPalette: (accent: string, complement: string) => ({
    accentAdjustment: 0,
    complementAdjustment: 0,
  }),
};

/**
 * Soft Touch Personality - Organic Warm
 * Gentle, pill-shaped, soft shadows - for form-ui
 */
export const softTouchPersonality: LibraryPersonality = {
  id: 'soft-touch',
  name: 'Soft Touch',
  description: 'Organic warm aesthetic - gentle, pill-shaped, ultra-soft',

  fonts: {
    heading: '"Quicksand", "Nunito", sans-serif',
    body: '"Nunito", system-ui, sans-serif',
    mono: '"Fira Code", monospace',
  },

  shadows: {
    small: '0 2px 8px rgba(0, 0, 0, 0.06)',
    medium: '0 8px 24px rgba(0, 0, 0, 0.08)',
    large: '0 20px 40px rgba(0, 0, 0, 0.1)',
    glow: '0 8px 32px rgba(var(--accent-rgb, 99, 102, 241), 0.15)',
  },

  borders: {
    width: '0.5px',
    style: 'solid',
    radius: '999px',
  },

  gradients: {
    primary:
      'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 80%, var(--complement)) 100%)',
    secondary:
      'linear-gradient(180deg, rgba(255, 240, 235, 0.8) 0%, rgba(255, 225, 215, 0.6) 100%)',
    accent: 'linear-gradient(135deg, var(--accent) 0%, var(--complement) 100%)',
    surface:
      'linear-gradient(180deg, var(--background) 0%, var(--surface) 100%)',
  },

  animations: {
    duration: {
      instant: '0ms',
      fast: '150ms',
      normal: '300ms',
      slow: '500ms',
    },
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  useHardShadows: false,
  useDiagonalGradients: false,
  useGlowEffects: true,
  useDottedBorders: false,
  usePillShape: true,
  useInsetShadows: false,
  useGridBackground: false,

  interpretPalette: (accent: string, complement: string) => ({
    accentAdjustment: -10,
    complementAdjustment: 15,
  }),
};

/**
 * Electric Personality - Vibrant Kinetic
 * Energetic, warm colors, playful - for social-ui
 */
export const electricPersonality: LibraryPersonality = {
  id: 'electric',
  name: 'Electric',
  description: 'Vibrant kinetic aesthetic - energetic, warm, conversational',

  fonts: {
    heading: '"DM Serif Display", Georgia, serif',
    body: '"Work Sans", system-ui, sans-serif',
    mono: '"JetBrains Mono", monospace',
  },

  shadows: {
    small: '0 2px 8px rgba(var(--accent-rgb, 255, 107, 53), 0.3)',
    medium: '0 4px 16px rgba(var(--accent-rgb, 255, 107, 53), 0.4)',
    large: '0 8px 32px rgba(var(--accent-rgb, 255, 107, 53), 0.5)',
    glow: '0 0 30px rgba(var(--accent-rgb, 255, 107, 53), 0.5)',
  },

  borders: {
    width: '2px',
    style: 'dotted',
    radius: '8px',
  },

  gradients: {
    primary: 'linear-gradient(135deg, #ff6b35 0%, #ff35a6 50%, #6b35ff 100%)',
    secondary: 'linear-gradient(180deg, #ffecd2 0%, #fcb69f 100%)',
    accent: 'linear-gradient(90deg, #ff6b35 0%, #ff35a6 100%)',
    surface: 'linear-gradient(180deg, #fff8f0 0%, #ffe8d6 100%)',
  },

  animations: {
    duration: {
      instant: '0ms',
      fast: '100ms',
      normal: '250ms',
      slow: '400ms',
    },
    easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },

  useHardShadows: false,
  useDiagonalGradients: true,
  useGlowEffects: true,
  useDottedBorders: true,
  usePillShape: false,
  useInsetShadows: false,
  useGridBackground: false,

  interpretPalette: (accent: string, complement: string) => ({
    accentAdjustment: 20,
    complementAdjustment: -10,
  }),
};

/**
 * Control Center Personality - Technical Dashboard
 * Precise, monospace, grid-based - for theme-ui
 */
export const controlCenterPersonality: LibraryPersonality = {
  id: 'control-center',
  name: 'Control Center',
  description: 'Technical dashboard aesthetic - precise, monospace, grid-based',

  fonts: {
    heading: '"Space Grotesk", system-ui, sans-serif',
    body: '"IBM Plex Sans", system-ui, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", monospace',
  },

  shadows: {
    small: 'inset 0 1px 2px rgba(0, 0, 0, 0.1)',
    medium: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)',
    large: 'inset 0 4px 8px rgba(0, 0, 0, 0.15)',
    glow: '0 0 0 rgba(0, 0, 0, 0)',
  },

  borders: {
    width: '1px',
    style: 'solid',
    radius: '2px',
  },

  gradients: {
    primary:
      'linear-gradient(180deg, var(--background) 0%, var(--surface) 100%)',
    secondary:
      'repeating-linear-gradient(0deg, transparent, transparent 19px, var(--border) 20px)',
    accent: 'linear-gradient(90deg, var(--accent) 0%, var(--accent) 100%)',
    surface:
      'linear-gradient(180deg, var(--surface) 0%, var(--background) 100%)',
  },

  animations: {
    duration: {
      instant: '0ms',
      fast: '50ms',
      normal: '100ms',
      slow: '200ms',
    },
    easing: 'steps(3, end)',
  },

  useHardShadows: false,
  useDiagonalGradients: false,
  useGlowEffects: false,
  useDottedBorders: false,
  usePillShape: false,
  useInsetShadows: true,
  useGridBackground: true,

  interpretPalette: (accent: string, complement: string) => ({
    accentAdjustment: -20,
    complementAdjustment: -30,
  }),
};

/**
 * Foundation Personality - Base Infrastructure
 * Minimal, functional, no-frills - for theme-lib
 */
export const foundationPersonality: LibraryPersonality = {
  id: 'foundation',
  name: 'Foundation',
  description: 'Base infrastructure - minimal, functional, no-frills',

  fonts: {
    heading: 'system-ui, -apple-system, sans-serif',
    body: 'system-ui, -apple-system, sans-serif',
    mono: '"SF Mono", Monaco, monospace',
  },

  shadows: {
    small: '0 1px 2px rgba(0, 0, 0, 0.05)',
    medium: '0 2px 4px rgba(0, 0, 0, 0.1)',
    large: '0 4px 8px rgba(0, 0, 0, 0.15)',
    glow: '0 0 0 transparent',
  },

  borders: {
    width: '1px',
    style: 'solid',
    radius: '4px',
  },

  gradients: {
    primary: 'none',
    secondary: 'none',
    accent: 'none',
    surface: 'none',
  },

  animations: {
    duration: {
      instant: '0ms',
      fast: '100ms',
      normal: '200ms',
      slow: '300ms',
    },
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  useHardShadows: false,
  useDiagonalGradients: false,
  useGlowEffects: false,
  useDottedBorders: false,
  usePillShape: false,
  useInsetShadows: false,
  useGridBackground: false,

  interpretPalette: (accent: string, complement: string) => ({
    accentAdjustment: 0,
    complementAdjustment: 0,
  }),
};

/**
 * All library personalities
 */
export const LIBRARY_PERSONALITIES: Record<
  LibraryPersonalityId,
  LibraryPersonality
> = {
  architect: architectPersonality,
  'soft-touch': softTouchPersonality,
  electric: electricPersonality,
  'control-center': controlCenterPersonality,
  foundation: foundationPersonality,
};

/**
 * Get personality by library ID
 */
export function getLibraryPersonality(libraryId: string): LibraryPersonality {
  const id = libraryId
    .toLowerCase()
    .replace(/[^a-z-]/g, '-') as LibraryPersonalityId;
  return LIBRARY_PERSONALITIES[id] || foundationPersonality;
}

/**
 * Get all library personality IDs
 */
export function getLibraryPersonalityIds(): LibraryPersonalityId[] {
  return Object.keys(LIBRARY_PERSONALITIES) as LibraryPersonalityId[];
}

/**
 * Generate CSS variables for a library personality
 */
export function generateLibraryCSSVariables(
  personality: LibraryPersonality
): Record<string, string> {
  return {
    '--lib-font-heading': personality.fonts.heading,
    '--lib-font-body': personality.fonts.body,
    '--lib-font-mono': personality.fonts.mono,

    '--lib-shadow-sm': personality.shadows.small,
    '--lib-shadow-md': personality.shadows.medium,
    '--lib-shadow-lg': personality.shadows.large,
    '--lib-shadow-glow': personality.shadows.glow,

    '--lib-border-width': personality.borders.width,
    '--lib-border-style': personality.borders.style,
    '--lib-border-radius': personality.borders.radius,

    '--lib-gradient-primary': personality.gradients.primary,
    '--lib-gradient-secondary': personality.gradients.secondary,
    '--lib-gradient-accent': personality.gradients.accent,
    '--lib-gradient-surface': personality.gradients.surface,

    '--lib-duration-instant': personality.animations.duration.instant,
    '--lib-duration-fast': personality.animations.duration.fast,
    '--lib-duration-normal': personality.animations.duration.normal,
    '--lib-duration-slow': personality.animations.duration.slow,
    '--lib-easing': personality.animations.easing,

    '--lib-hard-shadows': personality.useHardShadows ? '1' : '0',
    '--lib-diagonal-gradients': personality.useDiagonalGradients ? '1' : '0',
    '--lib-glow-effects': personality.useGlowEffects ? '1' : '0',
    '--lib-dotted-borders': personality.useDottedBorders ? '1' : '0',
    '--lib-pill-shape': personality.usePillShape ? '1' : '0',
    '--lib-inset-shadows': personality.useInsetShadows ? '1' : '0',
    '--lib-grid-background': personality.useGridBackground ? '1' : '0',
  };
}
