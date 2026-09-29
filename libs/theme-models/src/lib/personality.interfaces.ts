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
    inset: string;
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
  /**
   * Surface hue bias (Workstream E1, 2026-07-18 refactor plan). Mirrors the
   * `shadowTint` vocabulary so the two dimensions read as the same family of
   * concept applied to two different tokens: 'none' keeps the elevated
   * surface on the same neutral hue `background` already uses (the primary
   * color's hue at the personality's authored `neutralSaturation` — no
   * separate character); 'primary' anchors the surface hue to the primary
   * color as well but lets `surfaceSaturationShift` pull it to a visibly
   * higher saturation than the neutral background (a faint brand-tinted
   * lift); 'warm'/'cool' anchor the surface hue to the SAME fixed warm
   * (~30°) / cool (~210°) hues `generateShadowTintColor`
   * (`libs/theme-lib/.../color-harmony.ts`) uses for `shadowTint`, so a
   * personality can read as consistently warm- or cool-leaning across both
   * its shadows and its surfaces regardless of the user's chosen primary
   * color. `generateThemeResponsiveColors()` derives the actual surface
   * color from this plus `surfaceSaturationShift`, and auto-clamps the
   * shift downward (see that function's doc comment) if the biased surface
   * would fail the foreground/muted contrast requirement — this field
   * selects character, not a guaranteed rendered hue.
   */
  surfaceHueBias: 'none' | 'primary' | 'warm' | 'cool';
  /**
   * Saturation delta (percentage points) applied to the surface relative to
   * the neutral derivation (`background`'s saturation) before the hue bias
   * above is applied. Sane authored range is **0-12**: `0` keeps the
   * surface exactly as saturated as the neutral background (flat/untinted —
   * e.g. `architect`'s raw paper); higher values (up to ~12) read as a
   * clearly tinted lift (e.g. `electric`'s faint primary-tinted surface).
   * Auto-clamped downward at generation time if it would break contrast —
   * see `surfaceHueBias` and `generateThemeResponsiveColors()`.
   */
  surfaceSaturationShift: number;
}

/**
 * Mobile-specific adaptations
 */
export interface MobileAdaptations {
  touchTargetSize: string;
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
  autoAdjust: boolean;
}

/**
 * Shadow shape/rendering profile (Workstream B2, 2026-07-18 refactor plan).
 *
 * `shadowIntensity`/`shadowMultiplier` only scale a single soft-stacked-blur
 * shape; they cannot express a genuinely different silhouette (a 0-blur
 * brutalist offset vs. a diffuse warm blur vs. a primary-tinted glow all
 * "intensify" differently). `shadowProfile` is a separate, explicit
 * discriminator that `generatePersonalityShadows()`
 * (`libs/theme-lib/.../theme.service.ts`) switches on to emit structurally
 * different `--shadow-sm/md/lg/xl` shapes — see that function's doc comment
 * for the per-profile shape recipe. This is additive: `shadowIntensity` /
 * `shadowMultiplier` still scale magnitude within whichever profile shape is
 * selected.
 */
export type PersonalityShadowProfile =
  | 'layered'
  | 'diffuse'
  | 'hard-offset'
  | 'neon'
  | 'technical'
  | 'minimal'
  | 'playful-drop';

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
  /** Shadow shape/rendering profile — see `PersonalityShadowProfile`. */
  shadowProfile: PersonalityShadowProfile;
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

/** Control height, cell padding and surface padding scale. */
export type PersonalityDensity = 'compact' | 'comfortable' | 'airy';
/** Corner shape of small primitives: badges, chips, tabs, checkboxes. */
export type PersonalityShape = 'square' | 'crisp' | 'soft' | 'rounded' | 'pill';
/** Header treatment for dialogs and data tables. */
export type PersonalityHeaderStyle =
  | 'plain'
  | 'rule'
  | 'tint'
  | 'bar'
  | 'strip';
/** Surface treatment for cards, tiles, toasts and dialog bodies. */
export type PersonalitySurfaceStyle =
  | 'elevated'
  | 'outlined'
  | 'inset'
  | 'textured'
  | 'borderless';
/** Primary action fill. */
export type PersonalityFillStyle = 'flat' | 'gradient' | 'texture';
/** Active tab indicator. */
export type PersonalityTabStyle = 'underline' | 'segment' | 'pill';
/** How feedback (toasts, alerts) carries its tone colour. */
export type PersonalityFeedbackStyle = 'stripe' | 'tint' | 'outline';

/**
 * How a personality composes shared components. Resolved to CSS variables by
 * `resolveCompositionVariables` (theme-models) and emitted by ThemeService.
 */
export interface PersonalityComposition {
  density: PersonalityDensity;
  shape: PersonalityShape;
  header: PersonalityHeaderStyle;
  surface: PersonalitySurfaceStyle;
  fill: PersonalityFillStyle;
  tabs: PersonalityTabStyle;
  feedback: PersonalityFeedbackStyle;
  /** Letter case for dialog and table header titles. */
  labelCase: 'none' | 'uppercase';
}

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
    /**
     * Static, hand-authored fallback value. Since Workstream B2/B3
     * (2026-07-18 refactor plan), `--personality-box-shadow` and
     * `--personality-card-shadow` (from `components.card.boxShadow` below)
     * are DERIVED at generation time from the SAME profile-aware
     * `generatePersonalityShadows()` that produces `--shadow-sm/md/lg/xl`
     * (`ThemeService`, keyed off `PersonalityTokenOverrides.shadowProfile`) —
     * they are not read from this literal at runtime. This field remains the
     * source of truth only for consumers that read `Personality` objects
     * directly without going through `ThemeService` (e.g. `theme-ui`'s
     * `personality-comparison` swatch, owner-console) and as the emission
     * fallback if generation is ever unavailable. Mirrors the
     * `familyValue` precedent above: don't hand-author this to "fix" a
     * rendered shadow — change `shadowProfile`/`colorGeneration.shadowTint`
     * instead.
     */
    value: string;
  };
  typography: {
    fontFamily: PersonalityFontFamily;
    headingFamily: PersonalityFontFamily;
    bodyFamily: PersonalityFontFamily;
    fontWeight: PersonalityFontWeight;
    fontStyle: PersonalityFontStyle;
    /**
     * CSS font-family values. These are DERIVED from `Personality.fonts` (the
     * single source of truth) when the registry is assembled in
     * `personalities.ts` — they are not authored per-personality. Authoring them
     * by hand is what caused `--personality-font-family` to diverge from
     * `--font-heading`/`--font-body`; `personality-fonts.spec.ts` fails if they
     * ever disagree again. Optional here because the source objects omit them.
     */
    familyValue?: string;
    headingFamilyValue?: string;
    bodyFamilyValue?: string;
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
  /**
   * How interactive surfaces (buttons, cards, list items, controls) respond to
   * hover and press, and the accent border for emphasised surfaces. Emitted as
   * `--personality-hover-transform`, `--personality-hover-shadow`,
   * `--personality-active-transform`, `--personality-active-shadow` and
   * `--personality-accent-border`. A field left out is cleared, so a
   * component's `var(--personality-hover-shadow, <its own default>)` keeps its
   * own behaviour for personalities without a distinct treatment.
   */
  interaction?: {
    hoverTransform?: string;
    hoverShadow?: string;
    activeTransform?: string;
    activeShadow?: string;
    accentBorder?: string;
  };
  /**
   * Type treatment for small structural text: tab labels, metadata, badges,
   * table headers. Emitted as `--personality-label-font-family`,
   * `--personality-label-text-transform` and `--personality-label-letter-spacing`,
   * cleared when unset.
   */
  label?: {
    fontFamily?: string;
    textTransform?: string;
    letterSpacing?: string;
  };
  /**
   * How the personality composes shared components (density, primitive shape,
   * headers, surfaces, fills, tabs, feedback). Attached from
   * `COMPOSITION_BY_ID` when the registry is assembled.
   */
  composition?: PersonalityComposition;
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

  // Color generation (theme-responsive)
  colorGeneration: ColorGenerationConfig;

  // Mobile adaptations
  mobile: MobileAdaptations;

  // Page background pattern (SVG, theme-responsive)
  pageBackground?: {
    /** SVG pattern - colors will be replaced with theme colors */
    pattern: string;
    /** Whether pattern uses primary color tint */
    usePrimaryTint: boolean;
  };

  /**
   * Surface-level texture overlay (SVG, theme-responsive; Workstream C3,
   * 2026-07-18 refactor plan). Same delivery shape and runtime path as
   * `pageBackground` above (rendered through the SAME
   * `generatePageBackgroundPattern` + encode step in `ThemeService`, emitted
   * as `--surface-texture` instead of `--page-background-pattern`) — but
   * this one paints on top of `--surface`/`--background-elevated`, which
   * carries body text in ~198 consumer files. That's a materially tighter
   * legibility budget than a page backdrop, so the authoring cap here is
   * **0-0.05**, not `pageBackground`'s 0-0.08: a texture that's still
   * legible under running copy, not a decorative wash. Optional and
   * deliberately curated — most personalities have no surface texture at
   * all (absence is the default, not an omission to flag); only
   * personalities whose stated character is literally tactile/textured
   * (soft-touch's paper grain, control-center's scanlines, architect's
   * blueprint cross-hatch, electric's circuit accent, risograph's toner
   * specks, ledger's green-bar banding) declare one.
   */
  surfaceTexture?: {
    /** SVG pattern - colors will be replaced with theme colors */
    pattern: string;
    /** Whether pattern uses primary color tint */
    usePrimaryTint: boolean;
    /** Authored opacity, capped at 0.05 (surfaces carry text) */
    opacity: number;
  };

  // Metadata
  tags: string[];
  category: 'professional' | 'creative' | 'casual' | 'technical';
  isClassic?: boolean;

  // Extension layer (optional; absent reproduces today's output exactly)
  expression?: PersonalityExpression;
  typeScale?: PersonalityTypeScale;
  atmosphere?: PersonalityAtmosphere;
  motion?: PersonalityMotion;
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
  /** Secondary text: between foreground and muted, always readable. */
  textSecondary?: string;
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

// ─── Personality extension layer ───
// Colours still come only from the user's primary; these fields decide how
// that colour is applied and never introduce a palette.

/**
 * The canvas: the largest area on screen, and today identical for every
 * personality (light L96–100 near-white, dark L5–12 near-black).
 *
 * light:
 *  - `white`  today's behaviour (colorGeneration decides; no override)
 *  - `paper`  warm off-white stock, independent of the primary's hue
 *  - `tinted` very light wash of the primary's hue
 *  - `toned`  mid-light neutral canvas (enterprise "grey app, white cards"):
 *             cards sit LIGHTER than the page
 * dark:
 *  - `black`  today's behaviour (no override)
 *  - `ink`    deep, saturated primary-hued night (navy/aubergine/forest)
 *  - `tinted` dark with a moderate primary cast
 *  - `dim`    softer charcoal ("dim" mode), lower glare
 * Opted-in dark grounds elevate surfaces LIGHTER than the page (the
 * conventional dark-UI elevation), unlike today's darker-than-page surfaces.
 */
export type GroundLight = 'white' | 'paper' | 'tinted' | 'toned';
export type GroundDark = 'black' | 'ink' | 'tinted' | 'dim';

/**
 * How much of the primary colours the neutral UI, emitted as surface tints
 * and a new `--accent-ground` / `--on-accent-ground` pair for bands that
 * should carry brand colour (app bars, heroes, section headers).
 *  - `restrained`       primary only on controls; accent ground = surface
 *  - `tinted-surfaces`  surfaces and tab tracks take a faint primary wash
 *  - `primary-ground`   accent ground IS the primary (solid brand bands)
 *  - `duotone`          accent ground is the tertiary; borders pick up the
 *                       secondary — two inks instead of one
 */
export type AccentStrategy =
  | 'restrained'
  | 'tinted-surfaces'
  | 'primary-ground'
  | 'duotone';

export interface PersonalityExpression {
  ground?: { light?: GroundLight; dark?: GroundDark };
  accent?: AccentStrategy;
  /**
   * `hue-only` (today): the personality pins the primary's saturation and
   * lightness, so a grey/black/white brand colour becomes a saturated hue.
   * `respect`: a neutral base colour (low chroma) stays neutral — black
   * stays black-ish, greys stay grey; secondary/tertiary follow.
   */
  neutralBase?: 'hue-only' | 'respect';
}

/**
 * Typography beyond font family: a modular scale and heading treatment.
 * Emitted as `--type-*` / `--heading-*` variables.
 */
export interface PersonalityTypeScale {
  /** Modular scale ratio: 1.125 (dense) … 1.5 (display-led). */
  ratio: number;
  /** Heading font weight. */
  headingWeight: number;
  headingCase: 'none' | 'uppercase' | 'lowercase';
  /** Heading letter spacing, e.g. '-0.03em'. */
  headingTracking: string;
  /** Heading line height (unitless). */
  headingLineHeight: number;
}

/** Gradient light on the page behind everything. */
export type AtmosphereBackdrop =
  | 'none'
  | 'glow'
  | 'spotlight'
  | 'sweep'
  | 'horizon'
  | 'aurora'
  | 'mesh';
/** Finish on cards, panels, toasts and tab tracks. `glass` also makes surfaces translucent + blurred. */
export type AtmosphereSurface =
  | 'flat'
  | 'sheen'
  | 'gradient'
  | 'raised'
  | 'glass';
/** Gradient finish for `--accent-ground` bands (needs `expression.accent`). */
export type AtmosphereAccentFill =
  | 'flat'
  | 'linear'
  | 'radial'
  | 'mesh'
  | 'split'
  | 'shine';
/** Primary action fill. `inherit` keeps the composition's flat/gradient fill. */
export type AtmosphereButtonFill = 'inherit' | 'gradient' | 'split' | 'shine';
/** CSS-gradient patterns (no SVG): tiled ink in the text colour at low alpha. */
export type AtmospherePattern =
  | 'none'
  | 'dots'
  | 'grid'
  | 'diagonal'
  | 'stripes'
  | 'checker'
  | 'halftone'
  | 'rings'
  | 'waves'
  | 'scanline'
  | 'ledger';

/**
 * Texture and gradient "pop". Every colour is derived from the theme
 * (primary/secondary/tertiary, text colours), and every layer's alpha is
 * capped by the resolver so body text, muted text, on-accent and on-primary
 * text keep their contrast floors over the worst-case composite.
 */
export interface PersonalityAtmosphere {
  backdrop?: AtmosphereBackdrop;
  surface?: AtmosphereSurface;
  accentFill?: AtmosphereAccentFill;
  buttonFill?: AtmosphereButtonFill;
  /** Pattern tiled across the page canvas (under content, very low alpha). */
  pagePattern?: AtmospherePattern;
  /** Pattern tiled over `--accent-ground` bands (higher alpha, on-accent ink). */
  accentPattern?: AtmospherePattern;
  /** 0–1.5 multiplier on the default alphas (before contrast capping). Default 1. */
  intensity?: number;
}

/** How content arrives. `auto` (or absent) derives it from `presentation.animation.style`. */
export type MotionEnter =
  | 'auto'
  | 'none'
  | 'fade'
  | 'rise'
  | 'settle'
  | 'slide'
  | 'snap'
  | 'drift';
/** Hover/focus glow. `auto` (or absent) derives it from `tokens.shadowProfile`. */
export type MotionGlow = 'auto' | 'none' | 'soft' | 'halo' | 'neon';
/**
 * One slow, looping "sign of life" on brand elements. `auto` (or absent)
 * derives it from `presentation.animation.style`.
 *  - `breathe`  primary action's glow swells and settles
 *  - `pulse`    a soft ring expands from the primary action
 *  - `shimmer`  a sheen passes across the primary action and accent band
 *  - `drift`    the accent band's pattern slowly pans (needs `atmosphere.accentPattern`)
 */
export type MotionAmbient =
  | 'auto'
  | 'none'
  | 'breathe'
  | 'pulse'
  | 'shimmer'
  | 'drift';

/**
 * Motion character: entrances, interaction feedback (glow + focus ring) and
 * ambient motion. Hard limits (enforced by the resolver and validation):
 * entrance travel <= 8px, scale >= 0.97, duration <= 700ms; glow alpha <=
 * 0.35; ambient period >= 4s. Personalities with
 * `animations.prefersReducedMotion` get fade-only entrances and no ambient
 * motion; the CSS mixins disable all of it under `prefers-reduced-motion`.
 */
/**
 * motion-ui scenes a personality suits, most fitting first. Existing scenes
 * plus the proposed new ones (integration/motion-ui). An empty list means
 * "no background scene" (e.g. foundation).
 */
export type SceneKind =
  // existing libs/motion-ui scenes
  | 'aurora-ribbon'
  | 'glass-fog'
  | 'murmuration-scene'
  | 'parallax-grid-warp'
  | 'particle-veil'
  | 'pulse-rings'
  | 'shimmer-beam'
  | 'signal-mesh'
  | 'topographic-drift'
  // proposed personality scenes
  | 'halftone-tide'
  | 'star-atlas'
  | 'ledger-ticker'
  | 'grid-shift'
  | 'canopy-dapple'
  | 'clay-blobs'
  | 'neon-circuit'
  | 'blueprint-scan'
  | 'flock-field';

export interface PersonalityMotion {
  enter?: MotionEnter;
  glow?: MotionGlow;
  ambient?: MotionAmbient;
  /** motion-ui scenes this personality suits, most fitting first. */
  scenes?: SceneKind[];
}

/** Optional extension fields; absent means today's output. */
export interface PersonalityExtensions {
  expression?: PersonalityExpression;
  typeScale?: PersonalityTypeScale;
  atmosphere?: PersonalityAtmosphere;
  motion?: PersonalityMotion;
}
