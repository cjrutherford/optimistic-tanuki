/**
 * Centralized theme configuration
 * This file defines the standard CSS variable names and provides mapping for legacy names
 */

/**
 * Standard CSS variable names for theme colors
 * All components should use these standardized names
 */
export const STANDARD_THEME_VARIABLES = {
  // Core colors
  BACKGROUND: '--background',
  FOREGROUND: '--foreground',
  ACCENT: '--accent',
  COMPLEMENT: '--complement',
  TERTIARY: '--tertiary',
  SUCCESS: '--success',
  DANGER: '--danger',
  WARNING: '--warning',
  
  // Design tokens
  SPACING_PREFIX: '--spacing-',
  SHADOW_PREFIX: '--shadow-',
  BORDER_RADIUS_PREFIX: '--border-radius-',
  FONT_SIZE_PREFIX: '--font-size-',
  Z_INDEX_PREFIX: '--z-index-',
} as const;

/**
 * Legacy variable names that should be supported for backward compatibility
 * Maps old names to new standardized names
 */
export const LEGACY_VARIABLE_MAPPINGS: Record<string, string> = {
  '--background-color': STANDARD_THEME_VARIABLES.BACKGROUND,
  '--foreground-color': STANDARD_THEME_VARIABLES.FOREGROUND,
  '--accent-color': STANDARD_THEME_VARIABLES.ACCENT,
  '--complementary-color': STANDARD_THEME_VARIABLES.COMPLEMENT,
  '--complementary': STANDARD_THEME_VARIABLES.COMPLEMENT,
  '--tertiary-color': STANDARD_THEME_VARIABLES.TERTIARY,
  '--success-color': STANDARD_THEME_VARIABLES.SUCCESS,
  '--danger-color': STANDARD_THEME_VARIABLES.DANGER,
  '--warning-color': STANDARD_THEME_VARIABLES.WARNING,
};

/**
 * Get all variable names (standard + legacy) for a given standard variable
 */
export function getAllVariableNames(standardVariable: string): string[] {
  const allNames = [standardVariable];
  
  // Add legacy names that map to this standard variable
  for (const [legacyName, standardName] of Object.entries(LEGACY_VARIABLE_MAPPINGS)) {
    if (standardName === standardVariable) {
      allNames.push(legacyName);
    }
  }
  
  return allNames;
}

/**
 * Configuration for theme persistence
 */
export const THEME_STORAGE_CONFIG = {
  STORAGE_KEY: 'optimistic-tanuki-theme',
  CUSTOM_PALETTES_KEY: 'optimistic-tanuki-custom-palettes',
} as const;

/**
 * Default theme configuration
 */
export const DEFAULT_THEME_CONFIG = {
  theme: 'light' as const,
  accentColor: '#3f51b5',
  complementColor: '#c0af4b',
  paletteMode: 'custom' as const,
} as const;

/**
 * Type-safe way to access theme variable names
 */
export type StandardThemeVariable = typeof STANDARD_THEME_VARIABLES[keyof typeof STANDARD_THEME_VARIABLES];

/**
 * Helper to ensure type safety when working with CSS variables
 */
export function getStandardVariable(key: keyof typeof STANDARD_THEME_VARIABLES): string {
  return STANDARD_THEME_VARIABLES[key];
}
