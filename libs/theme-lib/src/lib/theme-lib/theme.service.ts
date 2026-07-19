/**
 * Enhanced Theme Service with Personality Support
 * Provides unified theming with personality-based design system
 */

import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

// Legacy utilities (migration/compatibility only)
import { generateComplementaryColor, hexToRgb } from './color-utils';
import { ThemeColors, ColorPalette, DesignTokens } from './theme.interface';
import { PREDEFINED_PALETTES } from './theme-palettes';
import {
  DEFAULT_DESIGN_TOKENS,
  generateDesignTokenCSSVariables,
} from './design-tokens';

// New personality system
import {
  Personality,
  PersonalityThemeConfig,
  GeneratedTheme,
  PersonalityColors,
  ContrastReport,
  PREDEFINED_PERSONALITIES,
  getDefaultPersonality,
  getPersonalityById,
  generatePersonalityColors,
  generatePerceptualShades,
  generateSemanticColors,
  ensureContrast,
  generateContrastReport,
  validateThemeContrast,
  getSuggestedTextColor,
  migratePaletteToPersonality,
} from '@optimistic-tanuki/theme-models';
import {
  generateThemeResponsiveColors,
  generateShadowTintColor,
  resolveShadowOpacity,
  generatePageBackgroundPattern,
} from './color-harmony';
import { FontLoadingService } from './font-loading.service';
import { GradientFactory } from './gradient-factory';

/**
 * Storage key for personality themes
 */
const PERSONALITY_THEME_KEY = 'optimistic-tanuki-personality-theme';

/** A resolved `rgba(...)`/`rgb(...)` builder, closed over a fixed tint. */
type TintFn = (opacity: number) => string;

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

/**
 * Generate personality-specific shadow tokens (Workstream B1 + B2, 2026-07-18
 * personality-styles-refactor plan; joint with the 07-14 plan's B2).
 *
 * `--shadow-sm/md/lg/xl` are resolved to literal CSS shadow strings at
 * generation time (not composed from `var(--shadow-color)` /
 * `var(--shadow-opacity)` via `color-mix`/similar) so they keep working as
 * plain CSS values wherever they're consumed. `shadowTintRgb` and
 * `shadowOpacity` are the SAME values emitted as `--shadow-color` /
 * `--shadow-opacity` (see `generatePersonalityCSSVariables`), so those
 * contracts can never drift apart (Workstream B1).
 *
 * Workstream B2 adds a SHAPE dimension on top of the tint:
 * `personality.tokens.shadowProfile` selects a genuinely different
 * silhouette, not just a differently-scaled version of the same soft
 * stacked blur —
 *
 * - `layered` (default/fallback): the original soft stacked blur.
 * - `diffuse`: large blur radii, reduced opacity, no offset — an ambient
 *   glow rather than a directional drop (soft-touch, elegant).
 * - `hard-offset`: 0-blur solid offset that grows with size — brutalist
 *   (architect).
 * - `neon`: outer glow built from the PRIMARY color, not the neutral/tinted
 *   shadow color — the one profile that deliberately ignores
 *   `shadowTintRgb` in favor of `primaryColor`, since a "neon" glow reads as
 *   the brand color (electric).
 * - `technical`: tight small offsets plus a crisp 1px ring at a lower alpha
 *   — instrument-panel feel (control-center, foundation).
 * - `minimal`: hairline ring only, collapsing to `none` when the
 *   personality's authored `shadowOpacity` is 0 (minimal).
 * - `playful-drop`: pronounced vertical offset with modest blur — a
 *   saturated, bouncy drop rather than a soft ambient lift (bold, playful).
 *
 * `--personality-box-shadow` / `--personality-card-shadow`
 * (`generatePersonalityCSSVariables`) are derived from this SAME function's
 * `md` / `lg` output rather than a second hand-authored literal — see the
 * doc comment on `PersonalityPresentation.shadow` in `theme-models`. This
 * function is exported (not a private class method) specifically so tests
 * and other callers can verify that single-source relationship directly.
 */
export function generatePersonalityShadows(
  personality: Personality,
  shadowTintRgb: { r: number; g: number; b: number },
  shadowOpacity: number,
  primaryColor: string
): DesignTokens['shadows'] {
  const multiplier = personality.tokens.shadowMultiplier;
  const tint: TintFn = (opacity) =>
    `rgba(${shadowTintRgb.r}, ${shadowTintRgb.g}, ${
      shadowTintRgb.b
    }, ${clampOpacity(opacity)})`;

  switch (personality.tokens.shadowProfile) {
    case 'diffuse':
      return generateDiffuseShadows(tint, shadowOpacity, multiplier);
    case 'hard-offset':
      return generateHardOffsetShadows(tint, shadowOpacity, multiplier);
    case 'neon':
      return generateNeonShadows(primaryColor, shadowOpacity, multiplier);
    case 'technical':
      return generateTechnicalShadows(tint, shadowOpacity, multiplier);
    case 'minimal':
      return generateMinimalShadows(tint, shadowOpacity);
    case 'playful-drop':
      return generatePlayfulDropShadows(tint, shadowOpacity, multiplier);
    case 'layered':
    default:
      return generateLayeredShadows(tint, shadowOpacity, multiplier);
  }
}

/** `layered`: the original soft stacked blur (default/fallback shape). */
function generateLayeredShadows(
  tint: TintFn,
  opacity: number,
  m: number
): DesignTokens['shadows'] {
  const c = tint(opacity);
  return {
    none: 'none',
    sm: `0 1px 2px 0 ${c}`,
    md: `0 4px ${6 * m}px -1px ${c}, 0 2px ${4 * m}px -1px ${c}`,
    lg: `0 10px ${15 * m}px -3px ${c}, 0 4px ${6 * m}px -2px ${c}`,
    xl: `0 20px ${25 * m}px -5px ${c}, 0 10px ${10 * m}px -5px ${c}`,
  };
}

/** `diffuse`: large blur, reduced opacity, no offset — an ambient glow. */
function generateDiffuseShadows(
  tint: TintFn,
  opacity: number,
  m: number
): DesignTokens['shadows'] {
  const c = tint(opacity * 0.6);
  return {
    none: 'none',
    sm: `0 0 ${8 * m}px 0 ${c}`,
    md: `0 0 ${20 * m}px 0 ${c}`,
    lg: `0 0 ${36 * m}px 0 ${c}`,
    xl: `0 0 ${56 * m}px 0 ${c}`,
  };
}

/** `hard-offset`: 0-blur solid offset, growing with size — brutalist. */
function generateHardOffsetShadows(
  tint: TintFn,
  opacity: number,
  m: number
): DesignTokens['shadows'] {
  const c = tint(opacity);
  return {
    none: 'none',
    sm: `${2 * m}px ${2 * m}px 0px ${c}`,
    md: `${4 * m}px ${4 * m}px 0px ${c}`,
    lg: `${6 * m}px ${6 * m}px 0px ${c}`,
    xl: `${10 * m}px ${10 * m}px 0px ${c}`,
  };
}

/**
 * `neon`: outer glow using the PRIMARY color (not the neutral/tinted shadow
 * color) — a neon glow reads as the brand color, not a shadow tint.
 */
function generateNeonShadows(
  primaryColor: string,
  opacity: number,
  m: number
): DesignTokens['shadows'] {
  const primaryRgb = hexToRgb(primaryColor) ?? { r: 0, g: 0, b: 0 };
  const glow: TintFn = (a) =>
    `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, ${clampOpacity(
      a
    )})`;
  return {
    none: 'none',
    sm: `0 0 ${4 * m}px 0 ${glow(opacity)}`,
    md: `0 0 ${12 * m}px 0 ${glow(opacity)}, 0 0 ${4 * m}px 0 ${glow(
      opacity * 1.4
    )}`,
    lg: `0 0 ${24 * m}px 0 ${glow(opacity)}, 0 0 ${8 * m}px 0 ${glow(
      opacity * 1.4
    )}`,
    xl: `0 0 ${40 * m}px 0 ${glow(opacity)}, 0 0 ${14 * m}px 0 ${glow(
      opacity * 1.6
    )}`,
  };
}

/**
 * `technical`: tight small offsets plus a crisp 1px ring at a lower alpha —
 * instrument-panel feel.
 */
function generateTechnicalShadows(
  tint: TintFn,
  opacity: number,
  m: number
): DesignTokens['shadows'] {
  const c = tint(opacity);
  const ring = tint(opacity * 0.8);
  return {
    none: 'none',
    sm: `0 1px 1px 0 ${c}, 0 0 0 1px ${ring}`,
    md: `0 1px ${2 * m}px 0 ${c}, 0 0 0 1px ${ring}`,
    lg: `0 2px ${4 * m}px 0 ${c}, 0 0 0 1px ${ring}`,
    xl: `0 4px ${8 * m}px 0 ${c}, 0 0 0 1px ${ring}`,
  };
}

/**
 * `minimal`: hairline ring only, collapsing to `none` when the personality's
 * authored `shadowOpacity` is 0 — minimal still respects intensity, it just
 * never renders a directional/blurred shadow.
 */
function generateMinimalShadows(
  tint: TintFn,
  opacity: number
): DesignTokens['shadows'] {
  if (opacity <= 0) {
    return { none: 'none', sm: 'none', md: 'none', lg: 'none', xl: 'none' };
  }
  return {
    none: 'none',
    sm: 'none',
    md: `0 0 0 1px ${tint(opacity)}`,
    lg: `0 0 0 1px ${tint(opacity)}`,
    xl: `0 0 0 1px ${tint(Math.min(1, opacity * 1.5))}`,
  };
}

/**
 * `playful-drop`: pronounced vertical offset, modest blur — a saturated,
 * bouncy drop rather than a soft ambient lift.
 */
function generatePlayfulDropShadows(
  tint: TintFn,
  opacity: number,
  m: number
): DesignTokens['shadows'] {
  const c = tint(opacity);
  return {
    none: 'none',
    sm: `0 ${3 * m}px ${4 * m}px 0 ${c}`,
    md: `0 ${6 * m}px ${8 * m}px 0 ${c}`,
    lg: `0 ${10 * m}px ${14 * m}px 0 ${c}`,
    xl: `0 ${16 * m}px ${20 * m}px 0 ${c}`,
  };
}

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  // Compatibility state
  private _theme!: 'light' | 'dark';
  private paletteMode: 'custom' | 'predefined' = 'predefined';
  private selectedPalette?: ColorPalette;
  private predefinedPalettes: ColorPalette[] = PREDEFINED_PALETTES;

  // New personality state
  private currentPersonality: Personality = getDefaultPersonality();
  private personalityConfig: PersonalityThemeConfig = {
    personalityId: 'classic',
    primaryColor: '#3f51b5',
    mode: 'light',
    version: '1.0.0',
  };

  // Behavior subjects
  theme: BehaviorSubject<'light' | 'dark' | undefined> = new BehaviorSubject<
    'light' | 'dark' | undefined
  >(undefined);

  private themeColors: BehaviorSubject<ThemeColors | undefined> =
    new BehaviorSubject<ThemeColors | undefined>(undefined);

  private availablePalettes: BehaviorSubject<ColorPalette[]> =
    new BehaviorSubject<ColorPalette[]>(this.predefinedPalettes);

  // New personality behavior subjects
  private personality: BehaviorSubject<Personality | undefined> =
    new BehaviorSubject<Personality | undefined>(undefined);

  private generatedTheme: BehaviorSubject<GeneratedTheme | undefined> =
    new BehaviorSubject<GeneratedTheme | undefined>(undefined);

  private availablePersonalities: BehaviorSubject<Personality[]> =
    new BehaviorSubject<Personality[]>(PREDEFINED_PERSONALITIES);

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private fontLoadingService: FontLoadingService,
    private gradientFactory: GradientFactory
  ) {
    if (isPlatformBrowser(this.platformId)) {
      // Initialize theme asynchronously but don't block
      this.initializeTheme()
        .then(() => {
          console.log('[ThemeService] Theme initialization complete');
        })
        .catch((error) => {
          console.error('[ThemeService] Theme initialization failed:', error);
          this.initializeDefaults();
        });
    } else {
      // SSR defaults
      this.initializeDefaults();
    }
  }

  /**
   * Initialize theme for browser environment
   */
  private async initializeTheme(): Promise<void> {
    try {
      const storedPersonalityTheme = this.loadPersonalityTheme();
      if (storedPersonalityTheme) {
        await this.initializePersonalityTheme(storedPersonalityTheme);
        return;
      }

      this.initializeDefaults();
    } catch (error) {
      console.error('Theme initialization failed:', error);
      this.initializeDefaults();
    }
  }

  /**
   * Initialize with personality system
   */
  private async initializePersonalityTheme(
    config: PersonalityThemeConfig
  ): Promise<void> {
    const personality = getPersonalityById(config.personalityId);

    if (!personality) {
      console.warn(
        `Personality "${config.personalityId}" not found, falling back to default`
      );
      this.initializeDefaults();
      return;
    }

    this.currentPersonality = personality;
    this.personalityConfig = config;

    // Determine mode
    const mode =
      config.mode === 'auto'
        ? this.detectPreferredMode()
        : config.mode || 'light';
    this._theme = mode;

    // Generate theme
    await this.generateAndApplyPersonalityTheme();

    // Notify subscribers
    this.theme.next(this._theme);
    this.personality.next(this.currentPersonality);

    // Load fonts
    await this.loadPersonalityFonts();
  }

  /**
   * Initialize default values
   */
  private initializeDefaults(): void {
    this._theme = 'light';
    this.currentPersonality = getDefaultPersonality();
    this.personalityConfig = {
      personalityId: 'classic',
      primaryColor: '#3f51b5',
      mode: 'light',
      version: '1.0.0',
    };

    this.theme.next(this._theme);
    this.personality.next(this.currentPersonality);
    this.generateAndApplyPersonalityTheme();
  }

  // ==================== PUBLIC API ====================

  /**
   * Get theme observable
   */
  theme$(): Observable<'light' | 'dark' | undefined> {
    return this.theme.asObservable();
  }

  /**
   * Get theme colors observable (legacy)
   */
  get themeColors$(): Observable<ThemeColors | undefined> {
    return this.themeColors.asObservable();
  }

  /**
   * Get available palettes observable (legacy)
   */
  get availablePalettes$(): Observable<ColorPalette[]> {
    return this.availablePalettes.asObservable();
  }

  /**
   * Get current personality observable
   */
  get personality$(): Observable<Personality | undefined> {
    return this.personality.asObservable();
  }

  /**
   * Get generated theme observable
   */
  get generatedTheme$(): Observable<GeneratedTheme | undefined> {
    return this.generatedTheme.asObservable();
  }

  /**
   * Get available personalities observable
   */
  get availablePersonalities$(): Observable<Personality[]> {
    return this.availablePersonalities.asObservable();
  }

  /**
   * Get current mode
   */
  getTheme(): 'light' | 'dark' {
    return this._theme;
  }

  /**
   * Set theme mode
   */
  setTheme(theme: 'light' | 'dark'): void {
    this._theme = theme;
    this.theme.next(theme);

    this.personalityConfig.mode = theme;
    this.savePersonalityTheme();
    this.generateAndApplyPersonalityTheme();
  }

  /**
   * Set personality
   */
  async setPersonality(personalityId: string): Promise<void> {
    const personality = getPersonalityById(personalityId);

    if (!personality) {
      console.error(`[ThemeService] Personality "${personalityId}" not found`);
      return;
    }

    console.log('[ThemeService] Setting personality:', personality.name);

    this.currentPersonality = personality;
    this.personalityConfig.personalityId = personalityId;

    // Save configuration FIRST to ensure persistence
    this.savePersonalityTheme();

    // Load new fonts
    await this.loadPersonalityFonts();

    // Generate and apply theme
    await this.generateAndApplyPersonalityTheme();

    // Notify subscribers
    this.personality.next(personality);

    console.log(
      '[ThemeService] Personality applied successfully:',
      personality.name
    );
  }

  /**
   * Set primary color
   */
  setPrimaryColor(color: string): void {
    this.personalityConfig.primaryColor = color;
    this.savePersonalityTheme();
    this.generateAndApplyPersonalityTheme();
  }

  /**
   * Get current personality
   */
  getCurrentPersonality(): Personality {
    return this.currentPersonality;
  }

  /**
   * Get current personality configuration
   */
  getPersonalityConfig(): PersonalityThemeConfig {
    return { ...this.personalityConfig };
  }

  /**
   * Toggle between light and dark mode
   */
  toggleTheme(): void {
    const newTheme = this._theme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  /**
   * Detect system preferred color scheme
   */
  detectPreferredMode(): 'light' | 'dark' {
    if (
      isPlatformBrowser(this.platformId) &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
    return 'light';
  }

  // ==================== GRADIENT API ====================

  /**
   * Get button gradient for current personality
   */
  getButtonGradient(
    variant: 'primary' | 'secondary' | 'outlined' = 'primary'
  ): string {
    const colors = this.getCurrentColors();
    const personalityId = this.currentPersonality?.id || 'classic';
    return this.gradientFactory.createButtonGradient(
      colors,
      personalityId,
      variant
    );
  }

  /**
   * Get card gradient for current personality
   */
  getCardGradient(
    variant: 'elevated' | 'glass' | 'flat' | 'gradient' = 'flat'
  ): string {
    const colors = this.getCurrentColors();
    const personalityId = this.currentPersonality?.id || 'classic';
    return this.gradientFactory.createCardGradient(
      colors,
      personalityId,
      variant
    );
  }

  /**
   * Get header gradient for current personality
   */
  getHeaderGradient(): string {
    const colors = this.getCurrentColors();
    const personalityId = this.currentPersonality?.id || 'classic';
    return this.gradientFactory.createHeaderGradient(colors, personalityId);
  }

  /**
   * Get background gradient for current personality
   */
  getBackgroundGradient(): string {
    const colors = this.getCurrentColors();
    const personalityId = this.currentPersonality?.id || 'classic';
    return this.gradientFactory.createBackgroundGradient(colors, personalityId);
  }

  /**
   * Get border gradient for current personality
   */
  getBorderGradient(): string {
    const colors = this.getCurrentColors();
    const personalityId = this.currentPersonality?.id || 'classic';
    return this.gradientFactory.createBorderGradient(colors, personalityId);
  }

  /**
   * Get current theme colors (handles both legacy and personality colors)
   */
  private getCurrentColors(): ThemeColors {
    const currentColors = this.themeColors.getValue();
    if (currentColors) {
      return currentColors;
    }
    // Fallback to default colors
    return {
      background: '#ffffff',
      foreground: '#0f172a',
      accent: '#3f51b5',
      accentShades: [],
      accentGradients: {},
      complementary: '#ff4081',
      complementaryShades: [],
      complementaryGradients: {},
      tertiary: '#00bcd4',
      tertiaryShades: [],
      tertiaryGradients: {},
      success: '#4caf50',
      successShades: [],
      successGradients: {},
      danger: '#f44336',
      dangerShades: [],
      dangerGradients: {},
      warning: '#ff9800',
      warningShades: [],
      warningGradients: {},
    };
  }

  /**
   * Get current personality animation settings
   */
  getAnimationSettings(): {
    prefersAnimation: boolean;
    duration: string;
    easing: string;
  } {
    const personality = this.currentPersonality;
    if (personality) {
      return {
        prefersAnimation: personality.animations.prefersReducedMotion
          ? false
          : true,
        duration: personality.animations.duration.normal,
        easing: personality.animations.easing,
      };
    }
    return {
      prefersAnimation: true,
      duration: '300ms',
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    };
  }

  /**
   * Get gradient strategy for a specific personality
   */
  getGradientStrategy(personalityId: string) {
    return this.gradientFactory.getStrategy(personalityId);
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Generate and apply personality-based theme
   * All colors are now generated from the primary color using personality parameters
   */
  private async generateAndApplyPersonalityTheme(): Promise<void> {
    const personality = this.currentPersonality;
    const config = this.personalityConfig;
    const mode = this._theme;

    // Generate colors using personality harmony (primary, secondary, tertiary)
    const colors = generatePersonalityColors(
      config.primaryColor,
      personality.colorHarmony.type,
      personality.colorHarmony.saturationBoost,
      personality.colorHarmony.lightnessShift,
      personality.colorHarmony.accentSaturation,
      personality.colorHarmony.accentLightness
    );

    // Generate shades using personality's curve
    const shadeCurve =
      personality.tokens.spacingScale === 'compact'
        ? 'ease-out'
        : personality.tokens.spacingScale === 'spacious'
        ? 'ease-in'
        : 'ease-in-out';

    const primaryShades = generatePerceptualShades(
      colors.primary,
      10,
      shadeCurve
    );
    const secondaryShades = generatePerceptualShades(
      colors.secondary,
      10,
      shadeCurve
    );
    const tertiaryShades = generatePerceptualShades(
      colors.tertiary,
      10,
      shadeCurve
    );

    // Generate semantic colors
    const semanticColors = generateSemanticColors(
      colors.primaryHsl.h,
      colors.primaryHsl.s,
      colors.primaryHsl.l
    );

    const successShades = generatePerceptualShades(
      semanticColors.success,
      10,
      shadeCurve
    );
    const warningShades = generatePerceptualShades(
      semanticColors.warning,
      10,
      shadeCurve
    );
    const dangerShades = generatePerceptualShades(
      semanticColors.danger,
      10,
      shadeCurve
    );
    const infoShades = generatePerceptualShades(
      semanticColors.info,
      10,
      shadeCurve
    );

    // Generate theme-responsive background/foreground colors. The surface
    // auto-clamp (Workstream E3) needs the personality's actual required
    // contrast ratio (4.5 or 7), not a hardcoded default.
    const themeColors = generateThemeResponsiveColors(
      config.primaryColor,
      personality.colorGeneration,
      mode,
      personality.contrast.minimumRatio
    );

    // Apply contrast adjustments to foreground
    const adjustedForeground = personality.contrast.autoAdjust
      ? ensureContrast(
          themeColors.foreground,
          themeColors.background,
          personality.contrast.minimumRatio,
          'auto'
        )
      : themeColors.foreground;

    // Generate the shadow tint (RGB only, no baked alpha — see B1) and the
    // single, mode-scaled opacity that both the `--shadow-*` tokens and the
    // `--shadow-color`/`--shadow-opacity` variables are built from.
    const shadowTintRgb = generateShadowTintColor(
      config.primaryColor,
      personality.colorGeneration.shadowTint,
      mode
    );
    const shadowOpacity = resolveShadowOpacity(
      personality.colorGeneration.shadowOpacity,
      mode
    );

    // Generate the profile-aware shadow tokens ONCE (Workstream B2/B3). Both
    // the `--shadow-sm/md/lg/xl` tokens (via `generatePersonalityTokens`)
    // AND `--personality-box-shadow`/`--personality-card-shadow` (via
    // `generatePersonalityCSSVariables`) are built from this SAME output, so
    // the two shadow contracts can never disagree — see
    // `generatePersonalityShadows`'s doc comment.
    const shadows = generatePersonalityShadows(
      personality,
      shadowTintRgb,
      shadowOpacity,
      colors.primary
    );

    // Build personality colors
    const personalityColors: PersonalityColors = {
      primary: colors.primary,
      primaryShades,
      secondary: colors.secondary,
      secondaryShades,
      tertiary: colors.tertiary,
      tertiaryShades,
      success: semanticColors.success,
      successShades,
      warning: semanticColors.warning,
      warningShades,
      danger: semanticColors.danger,
      dangerShades,
      info: semanticColors.info,
      infoShades,
      background: themeColors.background,
      foreground: adjustedForeground,
      surface: themeColors.surface,
      muted: themeColors.muted,
      border: themeColors.border,
      gradients: this.getPersonalityDrivenGradients(personality.id, {
        accent: colors.primary,
        complementary: colors.secondary,
        tertiary: colors.tertiary,
        background: themeColors.background,
        foreground: adjustedForeground,
      }),
    };

    // Validate contrast
    const contrastValidation = validateThemeContrast(
      {
        foreground: adjustedForeground,
        background: themeColors.background,
        primary: colors.primary,
        secondary: colors.secondary,
        muted: themeColors.muted,
      },
      personality.contrast.minimumRatio
    );

    // Generate CSS variables
    const cssVariables = this.generatePersonalityCSSVariables(
      personality,
      personalityColors,
      mode,
      themeColors.overlay,
      shadowTintRgb,
      shadowOpacity,
      shadows
    );

    // Build generated theme
    const generatedTheme: GeneratedTheme = {
      personality,
      config: { ...config },
      colors: personalityColors,
      tokens: this.generatePersonalityTokens(personality, shadows),
      cssVariables,
      fonts: personality.fonts,
      isValid: contrastValidation.isValid,
      contrastReport: contrastValidation.reports[0],
    };

    // Apply to DOM
    this.applyPersonalityTheme(generatedTheme);

    // Update legacy theme colors for backward compatibility
    const legacyColors = this.convertToLegacyColors(personalityColors);
    this.themeColors.next(legacyColors);

    // Update subjects
    this.generatedTheme.next(generatedTheme);
  }

  /**
   * Generate CSS variables from personality theme
   */
  private generatePersonalityCSSVariables(
    personality: Personality,
    colors: PersonalityColors,
    mode: 'light' | 'dark',
    overlay: string,
    shadowTintRgb: { r: number; g: number; b: number },
    shadowOpacity: number,
    shadows: DesignTokens['shadows']
  ): Record<string, string> {
    const variables: Record<string, string> = {};

    // Core colors
    variables['--background'] = colors.background;
    variables['--foreground'] = colors.foreground;
    variables['--surface'] = colors.surface;
    variables['--muted'] = colors.muted;
    // Alias `--muted-foreground` to `--muted` so the documented semantic token
    // resolves at runtime. Many apps (fin-commander, video-client, owner-console,
    // client-interface, forum-ui) reference `--muted-foreground`; without this
    // alias the property is undefined and `color: var(--muted-foreground)`
    // falls back to `currentColor`, defeating the muted visual hierarchy.
    variables['--muted-foreground'] = colors.muted;
    variables['--border'] = colors.border;

    // Primary colors
    variables['--primary'] = colors.primary;
    variables['--primary-foreground'] = getSuggestedTextColor(
      colors.primary
    ).color;
    colors.primaryShades.forEach((shade, i) => {
      variables[`--primary-${i}`] = shade;
    });

    // Secondary colors
    variables['--secondary'] = colors.secondary;
    variables['--secondary-foreground'] = getSuggestedTextColor(
      colors.secondary
    ).color;
    colors.secondaryShades.forEach((shade, i) => {
      variables[`--secondary-${i}`] = shade;
    });

    // Tertiary colors
    variables['--tertiary'] = colors.tertiary;
    variables['--tertiary-foreground'] = getSuggestedTextColor(
      colors.tertiary
    ).color;
    colors.tertiaryShades.forEach((shade, i) => {
      variables[`--tertiary-${i}`] = shade;
    });

    // Semantic colors
    variables['--success'] = colors.success;
    variables['--success-foreground'] = getSuggestedTextColor(
      colors.success
    ).color;
    variables['--warning'] = colors.warning;
    variables['--warning-foreground'] = getSuggestedTextColor(
      colors.warning
    ).color;
    variables['--danger'] = colors.danger;
    variables['--danger-foreground'] = getSuggestedTextColor(
      colors.danger
    ).color;
    variables['--info'] = colors.info;
    variables['--info-foreground'] = getSuggestedTextColor(colors.info).color;

    // --on-* aliases for the canonical design-system naming. These mirror the
    // existing *-foreground outputs so consumers can use either convention.
    variables['--on-primary'] = variables['--primary-foreground'];
    variables['--on-secondary'] = variables['--secondary-foreground'];
    variables['--on-tertiary'] = variables['--tertiary-foreground'];
    variables['--on-success'] = variables['--success-foreground'];
    variables['--on-warning'] = variables['--warning-foreground'];
    variables['--on-danger'] = variables['--danger-foreground'];
    variables['--on-info'] = variables['--info-foreground'];

    // Gradients - canonical source is GradientFactory
    Object.assign(
      variables,
      this.gradientFactory.createGradientVariables(personality.id, {
        accent: colors.primary,
        complementary: colors.secondary,
        tertiary: colors.tertiary,
        background: colors.background,
        foreground: colors.foreground,
      })
    );

    // Mode-specific (theme-responsive)
    variables['--background-base'] = colors.background;
    variables['--background-elevated'] = colors.surface;
    variables['--background-overlay'] = overlay;
    variables['--foreground-primary'] = colors.foreground;
    variables['--foreground-secondary'] = colors.border;
    variables['--foreground-muted'] = colors.muted;

    // Typography
    if (personality.fonts.heading) {
      variables['--font-heading'] = personality.fonts.heading.family;
    }
    variables['--font-body'] = personality.fonts.body.family;
    if (personality.fonts.mono) {
      variables['--font-mono'] = personality.fonts.mono.family;
    }

    // Animation
    variables['--animation-speed'] = personality.animations.speed;
    variables['--animation-easing'] = personality.animations.easing;
    variables['--animation-duration-fast'] =
      personality.animations.duration.fast;
    variables['--animation-duration-normal'] =
      personality.animations.duration.normal;
    variables['--animation-duration-slow'] =
      personality.animations.duration.slow;

    if (personality.presentation) {
      variables['--personality-border-style'] =
        personality.presentation.border.styleValue;
      variables['--personality-border-width'] =
        personality.presentation.border.widthValue;
      variables['--personality-border-radius'] =
        personality.presentation.border.radiusValue;
      // Workstream B2/B3 (2026-07-18 refactor plan): derived from the SAME
      // profile-aware `generatePersonalityShadows()` output that produces
      // `--shadow-sm/md/lg/xl` (see that function's doc comment and
      // `PersonalityPresentation.shadow`'s doc comment in theme-models) —
      // not read from the static `presentation.shadow.value` literal. This
      // keeps the two shadow contracts (17 consumers incl. common-ui
      // buttons vs. ~120 `--shadow-*` consumers) from disagreeing the way
      // fonts once did. The static literal is retained only as a fallback
      // if shadow generation is ever unavailable.
      variables['--personality-box-shadow'] =
        shadows?.md ?? personality.presentation.shadow.value;
      // Derived from personality.fonts (single source of truth); always agrees
      // with --font-heading. See personalities.ts withDerivedFontFamilies().
      if (personality.presentation.typography.familyValue) {
        variables['--personality-font-family'] =
          personality.presentation.typography.familyValue;
      }
      variables['--personality-font-weight'] =
        personality.presentation.typography.weightValue;
      variables['--personality-transition'] =
        personality.presentation.animation.transition;
      variables['--personality-button-radius'] =
        personality.presentation.components.button.borderRadius;
      variables['--personality-button-padding'] =
        personality.presentation.components.button.padding;
      variables['--personality-button-font-weight'] =
        personality.presentation.components.button.fontWeight;
      variables['--personality-button-text-transform'] =
        personality.presentation.components.button.textTransform;
      variables['--personality-card-radius'] =
        personality.presentation.components.card.borderRadius;
      variables['--personality-card-padding'] =
        personality.presentation.components.card.padding;
      // Same single-source rule as --personality-box-shadow above, using the
      // `lg` step (cards sit at a higher elevation than buttons/inputs).
      variables['--personality-card-shadow'] =
        shadows?.lg ?? personality.presentation.components.card.boxShadow;
      variables['--personality-input-radius'] =
        personality.presentation.components.input.borderRadius;
      variables['--personality-input-border-width'] =
        personality.presentation.components.input.borderWidth;
      variables['--personality-input-focus-style'] =
        personality.presentation.components.input.focusStyle;
    }

    // Page background pattern (theme-responsive)
    if (personality.pageBackground) {
      const svgPattern = generatePageBackgroundPattern(
        this.personalityConfig.primaryColor,
        personality.pageBackground.pattern,
        personality.pageBackground.usePrimaryTint,
        personality.colorGeneration.pageBackgroundOpacity,
        mode
      );

      // Encode SVG for use as a data URI (C0 fix). `encodeURIComponent`
      // already percent-encodes `"`, `<`, `>`, `#`, `%`, and whitespace; the
      // only character it deliberately leaves unescaped that is unsafe
      // inside a `url("...")` value is `'`. The previous five-way
      // `.replace()` chain re-escaped every percent sign the encoder had
      // just produced (turning `%3C` into `%253C`), so a single
      // `decodeURIComponent` pass on the emitted value yielded the LITERAL
      // text `%3Csvg...` instead of `<svg...>` — invalid, unrenderable SVG.
      const encodedPattern = encodeURIComponent(svgPattern).replace(
        /'/g,
        '%27'
      );

      variables[
        '--page-background-pattern'
      ] = `url("data:image/svg+xml,${encodedPattern}")`;
    } else {
      // Stale-variable guard (Workstream C3, 2026-07-18 refactor plan).
      // `applyPersonalityTheme()` below only SETS whatever properties this
      // record contains — it never diffs against what the PREVIOUS
      // personality emitted. Before this explicit clear, switching from a
      // personality that declares a `pageBackground` (e.g. `control-center`)
      // to one that doesn't (e.g. `classic`) left the old
      // `--page-background-pattern` value stuck as an inline style on
      // `document.documentElement` forever — a stale pattern would keep
      // rendering under a personality that declares none. Per the CSSOM
      // spec, `CSSStyleDeclaration.setProperty(prop, '')` is defined to
      // behave as `removeProperty(prop)`, so emitting `''` here actually
      // clears the previous value rather than merely no-op-ing.
      variables['--page-background-pattern'] = '';
    }

    // Surface texture (theme-responsive) — Workstream C3. Same delivery
    // mechanism as `--page-background-pattern` above (same
    // `generatePageBackgroundPattern` + single-`encodeURIComponent` encode
    // path), emitted as its own variable so a personality can vary its page
    // backdrop and its card-level texture independently. Uses the texture's
    // OWN authored opacity (`surfaceTexture.opacity`, capped at 0.05 —
    // tighter than `pageBackground`'s 0.08 cap, since this paints under
    // running text) rather than `pageBackgroundOpacity`.
    if (personality.surfaceTexture) {
      const svgTexture = generatePageBackgroundPattern(
        this.personalityConfig.primaryColor,
        personality.surfaceTexture.pattern,
        personality.surfaceTexture.usePrimaryTint,
        personality.surfaceTexture.opacity,
        mode
      );

      const encodedTexture = encodeURIComponent(svgTexture).replace(
        /'/g,
        '%27'
      );

      variables[
        '--surface-texture'
      ] = `url("data:image/svg+xml,${encodedTexture}")`;
    } else {
      // Same stale-variable hazard as `--page-background-pattern` above (and
      // the same fix): without this, switching soft-touch -> classic would
      // leave soft-touch's paper-grain texture painted under classic's flat
      // surface forever.
      variables['--surface-texture'] = '';
    }

    // Shadow color (theme-responsive) — Workstream B1. `--shadow-color` is
    // the resolved tint ONLY (an opaque `rgb()`, no alpha of its own);
    // `--shadow-opacity` is the single, mode-scaled opacity
    // (`personality.colorGeneration.shadowOpacity` via `resolveShadowOpacity`)
    // that both this pair AND the generated `--shadow-sm/md/lg/xl` tokens
    // (see `generatePersonalityShadows`) are built from. There is exactly
    // one opacity source now — do not reintroduce a second baked-in alpha.
    variables[
      '--shadow-color'
    ] = `rgb(${shadowTintRgb.r}, ${shadowTintRgb.g}, ${shadowTintRgb.b})`;
    variables['--shadow-opacity'] = String(shadowOpacity);

    return variables;
  }

  /**
   * Generate personality-aware design tokens
   */
  private generatePersonalityTokens(
    personality: Personality,
    shadows: DesignTokens['shadows']
  ): DesignTokens {
    const multiplier = personality.tokens.spacingMultiplier;

    return {
      spacing: {
        xs: `${4 * multiplier}px`,
        sm: `${8 * multiplier}px`,
        md: `${16 * multiplier}px`,
        lg: `${24 * multiplier}px`,
        xl: `${32 * multiplier}px`,
        xxl: `${48 * multiplier}px`,
      },
      shadows,
      borderRadius: this.generatePersonalityBorderRadius(personality),
      fontSize: DEFAULT_DESIGN_TOKENS.fontSize,
      zIndex: DEFAULT_DESIGN_TOKENS.zIndex,
    };
  }

  /**
   * Generate personality-specific border radius
   */
  private generatePersonalityBorderRadius(
    personality: Personality
  ): DesignTokens['borderRadius'] {
    const multiplier = personality.tokens.borderRadiusMultiplier;

    switch (personality.tokens.borderRadius) {
      case 'sharp':
        return {
          none: '0',
          sm: `${2 * multiplier}px`,
          md: `${4 * multiplier}px`,
          lg: `${6 * multiplier}px`,
          xl: `${8 * multiplier}px`,
          full: '50%',
        };
      case 'soft':
        return {
          none: '0',
          sm: `${4 * multiplier}px`,
          md: `${8 * multiplier}px`,
          lg: `${12 * multiplier}px`,
          xl: `${16 * multiplier}px`,
          full: '50%',
        };
      case 'round':
        return {
          none: '0',
          sm: `${8 * multiplier}px`,
          md: `${16 * multiplier}px`,
          lg: `${24 * multiplier}px`,
          xl: `${32 * multiplier}px`,
          full: '50%',
        };
      case 'pill':
        // Bounded, multiplier-scaled radii: emitting 9999px at every size made
        // any container using --border-radius-md/lg/xl a stadium shape that
        // clips corner content (and full: 50% turned non-square elements into
        // ellipses). Pill identity is carried by the largest base scale of any
        // style plus the true-pill `full` value for chips/buttons.
        return {
          none: '0',
          sm: `${10 * multiplier}px`,
          md: `${18 * multiplier}px`,
          lg: `${26 * multiplier}px`,
          xl: `${36 * multiplier}px`,
          full: '9999px',
        };
      default:
        return DEFAULT_DESIGN_TOKENS.borderRadius;
    }
  }

  /**
   * Apply personality theme to DOM
   */
  private applyPersonalityTheme(theme: GeneratedTheme): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const root = document.documentElement;

    // Apply CSS variables
    Object.entries(theme.cssVariables).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });

    // Apply design tokens
    const tokenVariables = generateDesignTokenCSSVariables(theme.tokens);
    Object.entries(tokenVariables).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });

    // Apply fonts
    this.fontLoadingService.applyFontVariables(theme.personality);

    // Apply body class contract for personality selectors
    this.applyBodyPersonalityClass(theme.personality.id);

    // Set root data attributes for mode/animation targeting
    root.setAttribute(
      'data-mode',
      theme.config.mode === 'auto' ? 'light' : theme.config.mode
    );
    root.setAttribute(
      'data-animation-speed',
      theme.personality.animations.speed
    );
  }

  private applyBodyPersonalityClass(personalityId: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const body = document.body;
    if (!body) {
      return;
    }

    for (const className of Array.from(body.classList)) {
      if (className.startsWith('personality-')) {
        body.classList.remove(className);
      }
    }

    body.classList.add(`personality-${personalityId}`);
  }

  /**
   * Load personality fonts
   */
  private async loadPersonalityFonts(): Promise<void> {
    try {
      await this.fontLoadingService.loadPersonalityFonts(
        this.currentPersonality
      );
    } catch (error) {
      console.warn('Failed to load personality fonts:', error);
    }
  }

  /**
   * Get personality-driven gradients for richer color variations
   * Falls back to generated gradients if personality-specific ones not available
   */
  private getPersonalityDrivenGradients(
    personalityId: string,
    colors: {
      accent: string;
      complementary: string;
      tertiary: string;
      background: string;
      foreground: string;
    }
  ): {
    primary: string;
    secondary: string;
    tertiary: string;
    surface: string;
  } {
    const personalityGradients =
      this.gradientFactory.getPersonalityGradientsFromColors(
        personalityId,
        colors
      );

    return {
      primary: personalityGradients.primary,
      secondary: personalityGradients.secondary,
      tertiary: personalityGradients.tertiary,
      surface: personalityGradients.surface,
    };
  }

  /**
   * Convert personality colors to legacy theme colors
   */
  private convertToLegacyColors(colors: PersonalityColors): ThemeColors {
    const shadesToTuples = (shades: string[]): [string, string][] => {
      return shades.map((shade, i) => [i.toString(), shade]);
    };

    return {
      background: colors.background,
      foreground: colors.foreground,
      accent: colors.primary,
      accentShades: shadesToTuples(colors.primaryShades),
      accentGradients: {
        light: colors.gradients.primary,
        dark: colors.gradients.primary,
        fastCycle: colors.gradients.primary,
      },
      complementary: colors.secondary,
      complementaryShades: shadesToTuples(colors.secondaryShades),
      complementaryGradients: {
        light: colors.gradients.secondary,
        dark: colors.gradients.secondary,
        fastCycle: colors.gradients.secondary,
      },
      tertiary: colors.tertiary,
      tertiaryShades: shadesToTuples(colors.tertiaryShades),
      tertiaryGradients: {
        light: colors.gradients.tertiary,
        dark: colors.gradients.tertiary,
        fastCycle: colors.gradients.tertiary,
      },
      success: colors.success,
      successShades: shadesToTuples(colors.successShades),
      successGradients: {
        light: `linear-gradient(135deg, ${colors.success})`,
        dark: `linear-gradient(135deg, ${colors.success})`,
        fastCycle: `linear-gradient(135deg, ${colors.success})`,
      },
      danger: colors.danger,
      dangerShades: shadesToTuples(colors.dangerShades),
      dangerGradients: {
        light: `linear-gradient(135deg, ${colors.danger})`,
        dark: `linear-gradient(135deg, ${colors.danger})`,
        fastCycle: `linear-gradient(135deg, ${colors.danger})`,
      },
      warning: colors.warning,
      warningShades: shadesToTuples(colors.warningShades),
      warningGradients: {
        light: `linear-gradient(135deg, ${colors.warning})`,
        dark: `linear-gradient(135deg, ${colors.warning})`,
        fastCycle: `linear-gradient(135deg, ${colors.warning})`,
      },
    };
  }

  /**
   * Load personality theme from storage
   */
  private loadPersonalityTheme(): PersonalityThemeConfig | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    try {
      const stored = localStorage.getItem(PERSONALITY_THEME_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate required fields
        if (parsed.personalityId && parsed.primaryColor && parsed.mode) {
          console.log('[ThemeService] Loaded personality theme:', parsed);
          return parsed;
        }
        console.warn('[ThemeService] Invalid stored theme, using defaults');
      }
    } catch (error) {
      console.error('[ThemeService] Failed to load personality theme:', error);
    }

    return null;
  }

  /**
   * Save personality theme to storage
   */
  private savePersonalityTheme(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      // Ensure we have valid config before saving
      const configToSave: PersonalityThemeConfig = {
        personalityId: this.personalityConfig.personalityId,
        primaryColor: this.personalityConfig.primaryColor,
        mode: this._theme,
        customizations: this.personalityConfig.customizations,
        version: this.personalityConfig.version || '1.0.0',
      };

      localStorage.setItem(PERSONALITY_THEME_KEY, JSON.stringify(configToSave));
      console.log('[ThemeService] Personality theme saved:', configToSave);
    } catch (error) {
      console.error('[ThemeService] Failed to save personality theme:', error);
    }
  }

  // ==================== LEGACY METHODS (Backward Compatibility) ====================

  /**
   * Compatibility: Set accent color
   */
  setAccentColor(accent: string, complement?: string): void {
    this.paletteMode = 'custom';
    this.selectedPalette = undefined;
    this.setPrimaryColor(accent);
  }

  /**
   * Compatibility: Set palette by migrating the selected palette to personality config
   */
  setPalette(paletteName: string): void {
    const palette = this.predefinedPalettes.find((p) => p.name === paletteName);

    if (palette) {
      const migration = migratePaletteToPersonality(palette, this._theme);
      if (migration.success) {
        this.personalityConfig = migration.config;
        const personality = getPersonalityById(
          migration.suggestedPersonalityId
        );
        if (personality) {
          this.currentPersonality = personality;
          this.selectedPalette = palette;
          this.paletteMode = 'predefined';
          this.generateAndApplyPersonalityTheme();
          this.savePersonalityTheme();
        }
      }
    }
  }

  /**
   * Compatibility: Get accent color
   */
  getAccentColor(): string {
    return this.personalityConfig.primaryColor;
  }

  /**
   * Compatibility: Get complementary color
   */
  getComplementaryColor(): string {
    const theme = this.generatedTheme.getValue();
    return (
      theme?.colors.secondary ||
      generateComplementaryColor(this.personalityConfig.primaryColor)
    );
  }

  // ==================== MISSING LEGACY PUBLIC METHODS ====================

  /**
   * Legacy: Get current palette
   */
  getCurrentPalette(): ColorPalette | undefined {
    return this.selectedPalette;
  }

  /**
   * Legacy: Get palette mode
   */
  getPaletteMode(): 'custom' | 'predefined' {
    return this.paletteMode;
  }

  /**
   * Legacy: Check if palette is predefined
   */
  isPredefinedPalette(name: string): boolean {
    return this.predefinedPalettes.some((p) => p.name === name);
  }

  /**
   * Legacy custom palettes removed
   */
  createCustomPalette(palette: ColorPalette): void {
    throw new Error(
      'Custom palettes are no longer supported. Use personality + primary color customization instead.'
    );
  }

  /**
   * Legacy: Update custom palette
   */
  updateCustomPalette(
    originalName: string,
    updatedPalette: ColorPalette
  ): void {
    throw new Error(
      `Custom palette updates are no longer supported (attempted to update "${originalName}").`
    );
  }

  /**
   * Legacy: Delete custom palette
   */
  deleteCustomPalette(name: string): void {
    throw new Error(
      `Custom palette deletion is no longer supported (attempted to delete "${name}").`
    );
  }

  // ==================== LIBRARY PERSONALITY API (DEPRECATED) ====================
  // Library personalities have been merged into the main personality system.
  // All UI components now use standard CSS custom properties (--primary, --font-body, etc.)
  // set by the active application personality. These methods are retained for backward
  // compatibility but will be removed in a future version.
}
