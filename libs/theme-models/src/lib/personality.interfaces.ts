/**
 * Personality-based design system interfaces
 * Pure TypeScript interfaces - no Angular dependencies
 */

// Re-export DesignTokens from existing interface
export interface DesignTokens {
  // Spacing scale
  spacing: {
    xs: string; // 4px
    sm: string; // 8px
    md: string; // 16px
    lg: string; // 24px
    xl: string; // 32px
    xxl: string; // 48px
  };

  // Shadow scale
  shadows: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };

  // Border radius scale
  borderRadius: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    full: string;
  };

  // Typography scale
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    xxl: string;
  };

  // Z-index scale
  zIndex: {
    base: number;
    dropdown: number;
    modal: number;
    tooltip: number;
    overlay: number;
  };
}

/**
 * Color harmony types for generating accent, complementary, and tertiary colors
 */
export type ColorHarmonyType =
  | 'complementary'
  | 'triadic'
  | 'analogous'
  | 'split-complementary'
  | 'tetradic';

/**
 * Typography style for personality
 */
export type TypographyStyle =
  | 'clean'
  | 'friendly'
  | 'elegant'
  | 'playful'
  | 'modern';

/**
 * Spacing scale multiplier
 */
export type SpacingScale = 'compact' | 'comfortable' | 'spacious' | 'airy';

/**
 * Border radius preference
 */
export type BorderRadiusStyle = 'sharp' | 'soft' | 'round' | 'pill';

/**
 * Shadow intensity
 */
export type ShadowIntensity = 'none' | 'subtle' | 'medium' | 'dramatic';

/**
 * Animation speed preference
 */
export type AnimationSpeed =
  | 'instant'
  | 'fast'
  | 'normal'
  | 'slow'
  | 'deliberate';

/**
 * Icon style preference
 */
export type IconStyle =
  | 'outlined'
  | 'filled'
  | 'rounded'
  | 'sharp'
  | 'two-tone';

/**
 * Border style preference
 */
export type BorderStyle = 'none' | 'hairline' | 'thin' | 'thick' | 'double';

/**
 * Font family configuration
 */
export interface FontConfig {
  family: string;
  weights: number[];
  display?: 'swap' | 'block' | 'fallback' | 'optional';
  preload?: boolean;
}

/**
 * Font loading configuration for a personality
 */
export interface PersonalityFonts {
  heading?: FontConfig;
  body: FontConfig;
  mono?: FontConfig;
  accent?: FontConfig;
}

/**
 * Animation configuration for a personality
 */
export interface AnimationConfig {
  speed: AnimationSpeed;
  easing: string;
  duration: {
    instant: string;
    fast: string;
    normal: string;
    slow: string;
  };
  staggerDelay: string;
  prefersReducedMotion: boolean;
}

/**
 * Color generation parameters for theme-responsive personalities
 * All colors are derived from the user's selected primary color
 */
export interface ColorGenerationConfig {
  /** Base background luminosity (0-100) for light mode */
  backgroundLuminosity: number;
  /** Elevated surface luminosity relative to background (offset, typically -2 to -5) */
  surfaceLuminosityOffset: number;
  /** Foreground contrast level - how dark text should be on light bg (0-100) */
  foregroundContrast: number;
  /** Secondary text luminosity relative to foreground (offset, typically +15 to +25) */
  secondaryLuminosityOffset: number;
  /** Muted text luminosity relative to foreground (offset, typically +25 to +35) */
  mutedLuminosityOffset: number;
  /** Saturation adjustment for neutrals (0-100, typically 0-10) */
  neutralSaturation: number;
  /** Dark mode luminosity reduction (percentage, typically 85-95%) */
  darkModeLuminosityScale: number;
  /** Dark mode saturation boost (typically 0-20%) */
  darkModeSaturationBoost: number;
  /** Shadow color derivation: 'neutral' | 'primary-tint' | 'warm' | 'cool' */
  shadowTint: 'neutral' | 'primary-tint' | 'warm' | 'cool';
  /** Shadow opacity multiplier (0.05 - 0.3) */
  shadowOpacity: number;
  /** Page background pattern opacity (0 - 0.2) */
  pageBackgroundOpacity: number;
}

/**
 * Mobile-specific adaptations
 */
export interface MobileAdaptations {
  spacingMultiplier: number;
  borderRadiusMultiplier: number;
  shadowReduction: number;
  fontScale: number;
  touchTargetSize: string;
}

/**
 * Mode-specific configuration (light/dark)
 */
export interface ModeConfig {
  background: {
    base: string;
    elevated: string;
    overlay: string;
    surface: string;
  };
  foreground: {
    primary: string;
    secondary: string;
    muted: string;
    inverted: string;
  };
  surfaceOpacity: number;
  shadowOpacity: number;
  shadowColor: string;
}

/**
 * Color harmony configuration
 */
export interface ColorHarmonyConfig {
  type: ColorHarmonyType;
  saturationBoost: number;
  lightnessShift: number;
  accentSaturation: number;
  accentLightness: number;
  complementDistance?: number;
  tertiaryDistance?: number;
  analogousSpread?: number;
}

/**
 * Contrast and accessibility configuration
 */
export interface ContrastConfig {
  minimumRatio: 4.5 | 7;
  enhancedRatio: 7 | 4.5;
  backgroundOffset: number;
  autoAdjust: boolean;
}

/**
 * Design tokens overrides for personality
 */
export interface PersonalityTokenOverrides {
  spacingScale: SpacingScale;
  spacingMultiplier: number;
  borderRadius: BorderRadiusStyle;
  borderRadiusMultiplier: number;
  borderStyle: BorderStyle;
  borderWidth: string;
  shadowIntensity: ShadowIntensity;
  shadowMultiplier: number;
  typography: TypographyStyle;
  lineHeight: number;
  letterSpacing: string;
}

export type PersonalityBorderStyle =
  | 'solid'
  | 'dashed'
  | 'dotted'
  | 'double'
  | 'groove'
  | 'ridge'
  | 'inset'
  | 'outset';
export type PersonalityBorderWidth = 'thin' | 'medium' | 'thick';
export type PersonalityBorderRadius =
  | 'none'
  | 'small'
  | 'medium'
  | 'large'
  | 'pill'
  | 'circle';
export type PersonalityShadowStyle =
  | 'none'
  | 'subtle'
  | 'medium'
  | 'dramatic'
  | 'neon'
  | 'glow';
export type PersonalityFontFamily =
  | 'sans-serif'
  | 'serif'
  | 'monospace'
  | 'display'
  | 'handwritten';
export type PersonalityFontWeight =
  | 'light'
  | 'normal'
  | 'medium'
  | 'semibold'
  | 'bold'
  | 'extrabold';
export type PersonalityFontStyle = 'normal' | 'italic' | 'oblique';
export type PersonalityAnimationStyle =
  | 'none'
  | 'subtle'
  | 'bouncy'
  | 'flowing'
  | 'pulsing'
  | 'wobbly';
export type PersonalityAnimationSpeed = 'fast' | 'normal' | 'slow';

export interface PersonalityPresentation {
  border: {
    style: PersonalityBorderStyle;
    width: PersonalityBorderWidth;
    radius: PersonalityBorderRadius;
    styleValue: string;
    widthValue: string;
    radiusValue: string;
  };
  shadow: {
    style: PersonalityShadowStyle;
    value: string;
  };
  typography: {
    fontFamily: PersonalityFontFamily;
    headingFamily: PersonalityFontFamily;
    bodyFamily: PersonalityFontFamily;
    fontWeight: PersonalityFontWeight;
    fontStyle: PersonalityFontStyle;
    familyValue: string;
    headingFamilyValue: string;
    bodyFamilyValue: string;
    weightValue: string;
  };
  animation: {
    style: PersonalityAnimationStyle;
    speed: PersonalityAnimationSpeed;
    timingFunction: string;
    duration: string;
    transition: string;
  };
  layout: {
    borderRadius: string;
    spacing: 'compact' | 'normal' | 'relaxed';
    maxWidth: string;
  };
  components: {
    button: {
      borderRadius: string;
      padding: string;
      fontWeight: string;
      textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
    };
    card: {
      borderRadius: string;
      padding: string;
      boxShadow: string;
    };
    input: {
      borderRadius: string;
      borderWidth: string;
      focusStyle: string;
    };
  };
}

/**
 * Complete personality definition
 */
export interface Personality {
  id: string;
  name: string;
  description: string;
  version: string;

  // Core configuration
  colorHarmony: ColorHarmonyConfig;
  contrast: ContrastConfig;

  // Design tokens
  tokens: PersonalityTokenOverrides;

  // Typography
  fonts: PersonalityFonts;

  // Animations
  animations: AnimationConfig;

  // Presentation contract layered on top of the personality metadata
  presentation?: PersonalityPresentation;

  // Icons
  iconStyle: IconStyle;

  // Color generation (theme-responsive)
  colorGeneration: ColorGenerationConfig;

  // Legacy mode support (optional, for backward compatibility during transition)
  modes?: {
    light: ModeConfig;
    dark: ModeConfig;
  };

  // Mobile adaptations
  mobile: MobileAdaptations;

  // Page background pattern (SVG, theme-responsive)
  pageBackground?: {
    /** SVG pattern - colors will be replaced with theme colors */
    pattern: string;
    /** Whether pattern uses primary color tint */
    usePrimaryTint: boolean;
  };

  // Metadata
  tags: string[];
  category: 'professional' | 'creative' | 'casual' | 'technical';
  isClassic?: boolean;
}

/**
 * User's theme configuration with personality
 */
export interface PersonalityThemeConfig {
  personalityId: string;
  primaryColor: string;
  mode: 'light' | 'dark' | 'auto';
  customizations?: Partial<PersonalityCustomizations>;
  version: string;
}

/**
 * Allowed user customizations within a personality
 */
export interface PersonalityCustomizations {
  primaryColor: string;
  mode: 'light' | 'dark' | 'auto';
  contrastPreference: 'normal' | 'high';
  reducedMotion: boolean;
  fontSizeAdjustment: number;
}

/**
 * Complete color palette generated from personality
 */
export interface PersonalityColors {
  // Base colors
  primary: string;
  primaryShades: string[];

  // Generated from harmony
  secondary: string;
  secondaryShades: string[];
  tertiary: string;
  tertiaryShades: string[];

  // Semantic colors
  success: string;
  successShades: string[];
  warning: string;
  warningShades: string[];
  danger: string;
  dangerShades: string[];
  info: string;
  infoShades: string[];

  // Mode-specific
  background: string;
  foreground: string;
  surface: string;
  muted: string;
  border: string;

  // Gradients
  gradients: {
    primary: string;
    secondary: string;
    tertiary: string;
    surface: string;
  };
}

/**
 * Generated theme from personality + user choices
 */
export interface GeneratedTheme {
  personality: Personality;
  config: PersonalityThemeConfig;
  colors: PersonalityColors;
  tokens: DesignTokens;
  cssVariables: Record<string, string>;
  fonts: PersonalityFonts;
  isValid: boolean;
  contrastReport: ContrastReport;
}

/**
 * WCAG contrast report
 */
export interface ContrastReport {
  isValid: boolean;
  ratio: number;
  level: 'AA' | 'AAA' | 'FAIL';
  foreground: string;
  background: string;
  adjustments?: string[];
}

/**
 * Contrast validation result for entire theme
 */
export interface ThemeContrastValidation {
  isValid: boolean;
  reports: ContrastReport[];
  violations: ContrastReport[];
  autoFixes?: Record<string, string>;
}

/**
 * API response for personalities endpoint
 */
export interface PersonalitiesApiResponse {
  personalities: Personality[];
  defaultPersonalityId: string;
  version: string;
}

/**
 * Legacy color palette interface
 */
export interface ColorPalette {
  name: string;
  description: string;
  accent: string;
  complementary: string;
  tertiary?: string;
  background?: {
    light: string;
    dark: string;
  };
  foreground?: {
    light: string;
    dark: string;
  };
}

/**
 * Legacy theme gradients
 */
export interface ThemeGradients {
  [key: string]: string;
}

/**
 * Legacy theme colors
 */
export interface ThemeColors {
  background: string;
  foreground: string;
  accent: string;
  accentShades: [string, string][];
  accentGradients: ThemeGradients;
  complementary: string;
  complementaryShades: [string, string][];
  complementaryGradients: ThemeGradients;
  tertiary: string;
  tertiaryShades: [string, string][];
  tertiaryGradients: ThemeGradients;
  success: string;
  successShades: [string, string][];
  successGradients: ThemeGradients;
  danger: string;
  dangerShades: [string, string][];
  dangerGradients: ThemeGradients;
  warning: string;
  warningShades: [string, string][];
  warningGradients: ThemeGradients;
}

/**
 * Legacy palette analysis for migration
 */
export interface PaletteAnalysis {
  saturation: number;
  contrast: number;
  harmony: ColorHarmonyType | null;
  spacing: 'compact' | 'comfortable' | 'spacious';
  warmth: number;
  vibrancy: number;
}

/**
 * Migration result from palette to personality
 */
export interface PaletteMigrationResult {
  success: boolean;
  suggestedPersonalityId: string;
  primaryColor: string;
  confidence: number;
  config: PersonalityThemeConfig;
  reason: string;
}
