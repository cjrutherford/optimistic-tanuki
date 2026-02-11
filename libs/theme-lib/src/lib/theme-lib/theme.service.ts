/**
 * Enhanced Theme Service with Personality Support
 * Provides unified theming with personality-based design system
 */

import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';

// Legacy utilities (maintaining backward compatibility)
import {
  generateColorShades,
  generateComplementaryColor,
  generateTertiaryColor,
} from './color-utils';
import { loadTheme, saveTheme, SavedTheme } from './theme-storage';
import { ThemeColors, ColorPalette, DesignTokens } from './theme.interface';
import { PREDEFINED_PALETTES, loadPredefinedPalettes } from './theme-palettes';
import {
  DEFAULT_DESIGN_TOKENS,
  generateDesignTokenCSSVariables,
} from './design-tokens';
import { STANDARD_THEME_VARIABLES, getAllVariableNames } from './theme-config';

// New personality system
import {
  Personality,
  PersonalityThemeConfig,
  GeneratedTheme,
  PersonalityColors,
  ContrastReport,
} from './personality.interface';
import {
  PREDEFINED_PERSONALITIES,
  getDefaultPersonality,
  getPersonalityById,
} from './personalities';
import {
  generatePersonalityColors,
  generatePerceptualShades,
  generateSemanticColors,
} from './color-harmony';
import {
  ensureContrast,
  generateContrastReport,
  validateThemeContrast,
  getSuggestedTextColor,
} from './contrast-utils';
import { FontLoadingService } from './font-loading.service';
import { migratePaletteToPersonality } from './palette-migration';
import {
  getPersonalityGradients,
  generateGradientVariables,
} from './personality-gradients';
import { GradientFactory } from './gradient-factory';

/**
 * Extended saved theme data including personality
 */
interface ExtendedSavedTheme extends SavedTheme {
  personalityId?: string;
  primaryColor?: string;
  mode?: 'light' | 'dark' | 'auto';
  version?: string;
}

/**
 * Storage key for personality themes
 */
const PERSONALITY_THEME_KEY = 'optimistic-tanuki-personality-theme';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  // Legacy state (maintaining backward compatibility)
  private _theme!: 'light' | 'dark';
  private accentColor!: string;
  private complementColor!: string;
  private paletteMode: 'custom' | 'predefined' = 'custom';
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
  private usePersonalitySystem = true; // Feature flag

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
      // Check if personality system is enabled
      const storedPersonalityTheme = this.loadPersonalityTheme();

      if (storedPersonalityTheme && this.usePersonalitySystem) {
        // Use new personality system
        await this.initializePersonalityTheme(storedPersonalityTheme);
      } else {
        // Fall back to legacy system
        this.initializeLegacyTheme();
      }
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
        `Personality "${config.personalityId}" not found, falling back to classic`
      );
      this.initializeLegacyTheme();
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
   * Initialize legacy theme system (backward compatibility)
   */
  private initializeLegacyTheme(): void {
    const init = () => {
      const customPalettes = this.loadCustomPalettes();
      const allPalettes = [...this.predefinedPalettes, ...customPalettes];
      this.availablePalettes.next(allPalettes);

      const storedTheme = loadTheme(this.platformId);
      const isFirstTime = !storedTheme.isInitialized;

      if (isFirstTime && this.predefinedPalettes.length > 0) {
        // Migrate first-time user to personality system
        const palette = this.predefinedPalettes[0];
        const migration = migratePaletteToPersonality(palette, 'light');

        if (migration.success) {
          this.personalityConfig = migration.config;
          this.currentPersonality =
            getPersonalityById(migration.suggestedPersonalityId) ||
            getDefaultPersonality();
        } else {
          this.initializeDefaults();
        }
      } else {
        // Use stored preferences
        this._theme = storedTheme.theme;
        this.accentColor = storedTheme.accentColor;
        this.complementColor = storedTheme.complementColor;
        this.paletteMode = storedTheme.paletteMode;

        if (this.paletteMode === 'predefined' && storedTheme.paletteName) {
          this.selectedPalette = this.predefinedPalettes.find(
            (p) => p.name === storedTheme.paletteName
          );
          if (this.selectedPalette) {
            this.accentColor = this.selectedPalette.accent;
            this.complementColor = this.selectedPalette.complementary;

            // Migrate to personality
            const migration = migratePaletteToPersonality(
              this.selectedPalette,
              this._theme
            );
            if (migration.success) {
              this.personalityConfig = migration.config;
              this.currentPersonality =
                getPersonalityById(migration.suggestedPersonalityId) ||
                getDefaultPersonality();
            }
          }
        }
      }

      this.theme.next(this._theme);
      this.themeColors.next(this.generateThemeColors());
      this.applyThemeColors();
      void this.updateAvailablePalettes();
    };

    init();
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

    if (this.usePersonalitySystem) {
      this.personalityConfig.mode = theme;
      this.savePersonalityTheme();
      this.generateAndApplyPersonalityTheme();
    } else {
      this.saveCurrentTheme();
      this.applyThemeColors();
    }
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
   */
  private async generateAndApplyPersonalityTheme(): Promise<void> {
    const personality = this.currentPersonality;
    const config = this.personalityConfig;
    const mode = this._theme;

    // Get mode configuration
    const modeConfig = personality.modes[mode];

    // Generate colors using personality harmony
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

    // Apply contrast adjustments
    const foreground = modeConfig.foreground.primary;
    const background = modeConfig.background.base;

    const adjustedForeground = personality.contrast.autoAdjust
      ? ensureContrast(
          foreground,
          background,
          personality.contrast.minimumRatio,
          'auto'
        )
      : foreground;

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
      background: modeConfig.background.base,
      foreground: adjustedForeground,
      surface: modeConfig.background.elevated,
      muted: modeConfig.foreground.muted,
      border: modeConfig.foreground.secondary,
      // Use personality-driven gradients for richer color variations
      gradients: this.getPersonalityDrivenGradients(personality.id, modeConfig),
    };

    // Validate contrast
    const contrastValidation = validateThemeContrast(
      {
        foreground: adjustedForeground,
        background: modeConfig.background.base,
        primary: colors.primary,
        secondary: colors.secondary,
        muted: modeConfig.foreground.muted,
      },
      personality.contrast.minimumRatio
    );

    // Generate CSS variables
    const cssVariables = this.generatePersonalityCSSVariables(
      personality,
      personalityColors,
      mode
    );

    // Build generated theme
    const generatedTheme: GeneratedTheme = {
      personality,
      config: { ...config },
      colors: personalityColors,
      tokens: this.generatePersonalityTokens(personality),
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
    mode: 'light' | 'dark'
  ): Record<string, string> {
    const variables: Record<string, string> = {};
    const modeConfig = personality.modes[mode];

    // Core colors
    variables['--background'] = colors.background;
    variables['--foreground'] = colors.foreground;
    variables['--surface'] = colors.surface;
    variables['--muted'] = colors.muted;
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

    // Gradients - personality-driven for richer color variations
    const personalityGradients = getPersonalityGradients(personality.id);
    variables['--primary-gradient'] = colors.gradients.primary;
    variables['--secondary-gradient'] = colors.gradients.secondary;
    variables['--tertiary-gradient'] = colors.gradients.tertiary;
    variables['--surface-gradient'] = colors.gradients.surface;
    variables['--gradient-glow'] = personalityGradients.glow;
    variables['--gradient-border'] = personalityGradients.border;
    variables['--gradient-text'] = personalityGradients.text;
    variables['--gradient-animated'] =
      personalityGradients.animated || colors.gradients.primary;

    // Mode-specific
    variables['--background-base'] = modeConfig.background.base;
    variables['--background-elevated'] = modeConfig.background.elevated;
    variables['--background-overlay'] = modeConfig.background.overlay;
    variables['--foreground-primary'] = modeConfig.foreground.primary;
    variables['--foreground-secondary'] = modeConfig.foreground.secondary;
    variables['--foreground-muted'] = modeConfig.foreground.muted;

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

    // Page background pattern (if defined by personality)
    if (personality.pageBackground) {
      const svgPattern =
        mode === 'light'
          ? personality.pageBackground.light
          : personality.pageBackground.dark;

      // Encode SVG for use as data URI
      const encodedPattern = encodeURIComponent(svgPattern)
        .replace(/'/g, '%27')
        .replace(/"/g, '%22')
        .replace(/%/g, '%25')
        .replace(/</g, '%3C')
        .replace(/>/g, '%3E')
        .replace(/#/g, '%23')
        .replace(/\s+/g, ' ');

      variables[
        '--page-background-pattern'
      ] = `url("data:image/svg+xml,${encodedPattern}")`;
    }

    return variables;
  }

  /**
   * Generate personality-aware design tokens
   */
  private generatePersonalityTokens(personality: Personality): DesignTokens {
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
      shadows: this.generatePersonalityShadows(personality),
      borderRadius: this.generatePersonalityBorderRadius(personality),
      fontSize: DEFAULT_DESIGN_TOKENS.fontSize,
      zIndex: DEFAULT_DESIGN_TOKENS.zIndex,
    };
  }

  /**
   * Generate personality-specific shadows
   */
  private generatePersonalityShadows(
    personality: Personality
  ): DesignTokens['shadows'] {
    const multiplier = personality.tokens.shadowMultiplier;
    const opacity = personality.modes.light.shadowOpacity;

    const shadowColor = `rgba(0, 0, 0, ${opacity})`;

    return {
      none: 'none',
      sm: `0 1px 2px 0 ${shadowColor}`,
      md: `0 4px ${6 * multiplier}px -1px ${shadowColor}, 0 2px ${
        4 * multiplier
      }px -1px ${shadowColor}`,
      lg: `0 10px ${15 * multiplier}px -3px ${shadowColor}, 0 4px ${
        6 * multiplier
      }px -2px ${shadowColor}`,
      xl: `0 20px ${25 * multiplier}px -5px ${shadowColor}, 0 10px ${
        10 * multiplier
      }px -5px ${shadowColor}`,
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
        return {
          none: '0',
          sm: '9999px',
          md: '9999px',
          lg: '9999px',
          xl: '9999px',
          full: '50%',
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

    // Set data attributes for CSS targeting
    root.setAttribute('data-personality', theme.personality.id);
    root.setAttribute(
      'data-mode',
      theme.config.mode === 'auto' ? 'light' : theme.config.mode
    );
    root.setAttribute(
      'data-animation-speed',
      theme.personality.animations.speed
    );
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
   * Generate gradient from shades
   */
  private generateGradientFromShades(shades: string[]): string {
    return `linear-gradient(135deg, ${shades[0]}, ${shades[3]}, ${shades[6]}, ${shades[9]})`;
  }

  /**
   * Get personality-driven gradients for richer color variations
   * Falls back to generated gradients if personality-specific ones not available
   */
  private getPersonalityDrivenGradients(
    personalityId: string,
    modeConfig: any
  ): {
    primary: string;
    secondary: string;
    tertiary: string;
    surface: string;
  } {
    const personalityGradients = getPersonalityGradients(personalityId);

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
   * Legacy: Set accent color
   */
  setAccentColor(accent: string, complement?: string): void {
    if (this.usePersonalitySystem) {
      this.setPrimaryColor(accent);
    } else {
      this.accentColor = accent;
      this.complementColor = complement || generateComplementaryColor(accent);
      this.paletteMode = 'custom';
      this.selectedPalette = undefined;
      this.saveCurrentTheme();
      this.applyThemeColors();
    }
  }

  /**
   * Legacy: Set palette
   */
  setPalette(paletteName: string): void {
    let palette = this.predefinedPalettes.find((p) => p.name === paletteName);

    if (!palette && isPlatformBrowser(this.platformId)) {
      const customPalettes = this.loadCustomPalettes();
      palette = customPalettes.find((p) => p.name === paletteName);
    }

    if (palette) {
      if (this.usePersonalitySystem) {
        // Migrate palette to personality
        const migration = migratePaletteToPersonality(palette, this._theme);
        if (migration.success) {
          this.personalityConfig = migration.config;
          const personality = getPersonalityById(
            migration.suggestedPersonalityId
          );
          if (personality) {
            this.currentPersonality = personality;
            this.generateAndApplyPersonalityTheme();
            this.savePersonalityTheme();
          }
        }
      } else {
        this.selectedPalette = palette;
        this.accentColor = palette.accent;
        this.complementColor = palette.complementary;
        this.paletteMode = 'predefined';
        this.saveCurrentTheme();
        this.applyThemeColors();
      }
    }
  }

  /**
   * Legacy: Get accent color
   */
  getAccentColor(): string {
    if (this.usePersonalitySystem) {
      return this.personalityConfig.primaryColor;
    }
    return this.accentColor;
  }

  /**
   * Legacy: Get complementary color
   */
  getComplementaryColor(): string {
    if (this.usePersonalitySystem) {
      const theme = this.generatedTheme.getValue();
      return (
        theme?.colors.secondary ||
        generateComplementaryColor(this.personalityConfig.primaryColor)
      );
    }
    return this.complementColor;
  }

  /**
   * Legacy: Save current theme
   */
  private saveCurrentTheme(): void {
    const themeData: SavedTheme = {
      theme: this._theme,
      accentColor: this.accentColor,
      complementColor: this.complementColor,
      paletteMode: this.paletteMode,
      paletteName: this.selectedPalette?.name,
      isInitialized: true,
    };

    if (isPlatformBrowser(this.platformId)) {
      saveTheme(this.platformId, themeData);
    }
  }

  /**
   * Legacy: Load custom palettes
   */
  private loadCustomPalettes(): ColorPalette[] {
    if (!isPlatformBrowser(this.platformId)) {
      return [];
    }

    const saved = localStorage.getItem('customPalettes');
    return saved ? JSON.parse(saved) : [];
  }

  /**
   * Legacy: Update available palettes
   */
  private async updateAvailablePalettes(): Promise<void> {
    try {
      this.predefinedPalettes = await loadPredefinedPalettes();
    } catch (e) {
      console.warn('Failed to update predefined palettes:', e);
      this.predefinedPalettes = PREDEFINED_PALETTES;
    }
    const customPalettes = this.loadCustomPalettes();
    this.availablePalettes.next([
      ...this.predefinedPalettes,
      ...customPalettes,
    ]);
  }

  /**
   * Legacy: Generate theme colors
   */
  private generateThemeColors(): ThemeColors {
    let background = this._theme === 'light' ? '#ffffff' : '#1a1a2e';
    let foreground = this._theme === 'light' ? '#212121' : '#ffffff';

    if (this.selectedPalette) {
      if (this.selectedPalette.background) {
        background =
          this._theme === 'light'
            ? this.selectedPalette.background.light
            : this.selectedPalette.background.dark;
      }
      if (this.selectedPalette.foreground) {
        foreground =
          this._theme === 'light'
            ? this.selectedPalette.foreground.light
            : this.selectedPalette.foreground.dark;
      }
    }

    const accentShades = generateColorShades(this.accentColor);
    const complementaryShades = generateColorShades(this.complementColor);
    const tertiaryColor =
      this.selectedPalette?.tertiary || generateTertiaryColor(this.accentColor);
    const tertiaryShades = generateColorShades(tertiaryColor);

    return {
      background,
      foreground,
      accent: this.accentColor,
      accentShades,
      accentGradients: this.generateLegacyGradients(accentShades),
      complementary: this.complementColor,
      complementaryShades,
      complementaryGradients: this.generateLegacyGradients(complementaryShades),
      tertiary: tertiaryColor,
      tertiaryShades,
      tertiaryGradients: this.generateLegacyGradients(tertiaryShades),
      success: '#4caf50',
      successShades: generateColorShades('#4caf50'),
      successGradients: this.generateLegacyGradients(
        generateColorShades('#4caf50')
      ),
      danger: '#f44336',
      dangerShades: generateColorShades('#f44336'),
      dangerGradients: this.generateLegacyGradients(
        generateColorShades('#f44336')
      ),
      warning: '#ff9800',
      warningShades: generateColorShades('#ff9800'),
      warningGradients: this.generateLegacyGradients(
        generateColorShades('#ff9800')
      ),
    };
  }

  /**
   * Legacy: Generate gradients
   */
  private generateLegacyGradients(shades: [string, string][]): {
    [key: string]: string;
  } {
    return {
      light: `linear-gradient(135deg, ${shades[0][1]}, ${shades[1][1]}, ${shades[2][1]}, ${shades[3][1]}, ${shades[4][1]})`,
      dark: `linear-gradient(135deg, ${shades[5][1]}, ${shades[6][1]}, ${shades[7][1]}, ${shades[8][1]}, ${shades[9][1]})`,
      fastCycle: `linear-gradient(45deg, ${shades
        .map(([, shade]) => shade)
        .join(', ')})`,
    };
  }

  /**
   * Legacy: Apply theme colors
   */
  private applyThemeColors(): void {
    const themeColors = this.generateThemeColors();
    this.themeColors.next(themeColors);

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Apply design tokens
    const designTokens = generateDesignTokenCSSVariables(DEFAULT_DESIGN_TOKENS);
    Object.entries(designTokens).forEach(([property, value]) => {
      document.documentElement.style.setProperty(property, value);
    });

    // Apply theme colors
    this.setThemeVariable(
      STANDARD_THEME_VARIABLES.BACKGROUND,
      themeColors.background
    );
    this.setThemeVariable(
      STANDARD_THEME_VARIABLES.FOREGROUND,
      themeColors.foreground
    );
    this.setThemeVariable(STANDARD_THEME_VARIABLES.ACCENT, themeColors.accent);
    this.setThemeVariable(
      STANDARD_THEME_VARIABLES.COMPLEMENT,
      themeColors.complementary
    );
    this.setThemeVariable(
      STANDARD_THEME_VARIABLES.TERTIARY,
      themeColors.tertiary
    );
  }

  /**
   * Legacy: Set theme variable
   */
  private setThemeVariable(standardVariable: string, value: string): void {
    const allNames = getAllVariableNames(standardVariable);
    allNames.forEach((varName) => {
      document.documentElement.style.setProperty(varName, value);
    });
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
   * Legacy: Create custom palette
   */
  createCustomPalette(palette: ColorPalette): void {
    const customPalettes = this.loadCustomPalettes();

    // Check if palette with same name already exists
    if (
      customPalettes.some((p) => p.name === palette.name) ||
      this.predefinedPalettes.some((p) => p.name === palette.name)
    ) {
      throw new Error(`Palette with name "${palette.name}" already exists`);
    }

    customPalettes.push(palette);
    this.saveCustomPalettes(customPalettes);
  }

  /**
   * Legacy: Update custom palette
   */
  updateCustomPalette(
    originalName: string,
    updatedPalette: ColorPalette
  ): void {
    const customPalettes = this.loadCustomPalettes();
    const index = customPalettes.findIndex((p) => p.name === originalName);

    if (index === -1) {
      throw new Error(`Palette with name "${originalName}" not found`);
    }

    // Check if new name conflicts with another palette
    if (originalName !== updatedPalette.name) {
      if (
        customPalettes.some(
          (p, i) => i !== index && p.name === updatedPalette.name
        ) ||
        this.predefinedPalettes.some((p) => p.name === updatedPalette.name)
      ) {
        throw new Error(
          `Palette with name "${updatedPalette.name}" already exists`
        );
      }
    }

    customPalettes[index] = updatedPalette;
    this.saveCustomPalettes(customPalettes);

    // If currently using this palette, update the active theme
    if (this.selectedPalette?.name === originalName) {
      this.setPalette(updatedPalette.name);
    }
  }

  /**
   * Legacy: Delete custom palette
   */
  deleteCustomPalette(name: string): void {
    const customPalettes = this.loadCustomPalettes();
    const filtered = customPalettes.filter((p) => p.name !== name);

    if (filtered.length === customPalettes.length) {
      throw new Error(`Palette with name "${name}" not found`);
    }

    this.saveCustomPalettes(filtered);

    // If currently using this palette, switch to default
    if (this.selectedPalette?.name === name) {
      this.paletteMode = 'custom';
      this.selectedPalette = undefined;
      this.saveCurrentTheme();
      this.applyThemeColors();
    }
  }

  /**
   * Legacy: Save custom palettes
   */
  private saveCustomPalettes(palettes: ColorPalette[]): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.setItem('customPalettes', JSON.stringify(palettes));
    void this.updateAvailablePalettes();
  }
}
