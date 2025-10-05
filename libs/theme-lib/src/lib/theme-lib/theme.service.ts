import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  generateColorShades,
  generateComplementaryColor,
  generateDangerColor,
  generateWarningColor,
  generateSuccessColor,
  generateTertiaryColor,
} from './color-utils';
import { loadTheme, saveTheme, SavedTheme } from './theme-storage';
import { ThemeColors, ColorPalette } from './theme.interface';
import { isPlatformBrowser } from '@angular/common';
import { PREDEFINED_PALETTES, getPaletteByName } from './theme-palettes';
import { DEFAULT_DESIGN_TOKENS, generateDesignTokenCSSVariables } from './design-tokens';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private _theme: 'light' | 'dark';
  private accentColor: string;
  private complementColor: string;
  private paletteMode: 'custom' | 'predefined' = 'custom';
  private selectedPalette?: ColorPalette;
  
  theme: BehaviorSubject<'light' | 'dark' | undefined> = new BehaviorSubject<'light' | 'dark' | undefined>(undefined);
  private themeColors: BehaviorSubject<ThemeColors | undefined> = new BehaviorSubject<ThemeColors | undefined>(undefined);
  private availablePalettes: BehaviorSubject<ColorPalette[]> = new BehaviorSubject<ColorPalette[]>(PREDEFINED_PALETTES);

  constructor(@Inject(PLATFORM_ID) private platformId: object) {
    if(isPlatformBrowser(this.platformId)) {
      const storedTheme = loadTheme(this.platformId);
      this._theme = storedTheme.theme;
      this.accentColor = storedTheme.accentColor;
      this.complementColor = storedTheme.complementColor;
      this.paletteMode = storedTheme.paletteMode;
      
      if (this.paletteMode === 'predefined' && storedTheme.paletteName) {
        this.selectedPalette = getPaletteByName(storedTheme.paletteName);
        if (this.selectedPalette) {
          this.accentColor = this.selectedPalette.accent;
          this.complementColor = this.selectedPalette.complementary;
        }
      }

      this.theme.next(this._theme);
      this.themeColors.next(this.generateThemeColors());
      this.applyThemeColors();
    } else {
      // Initialize default values for SSR
      this._theme = 'light';
      this.accentColor = '#3f51b5';
      this.complementColor = '#c0af4b';
      this.theme.next(this._theme);
      this.themeColors.next(this.generateThemeColors());
    }
  }

  theme$() {
    return this.theme.asObservable();
  }
  
  get themeColors$() {
    return this.themeColors.asObservable();
  }

  get availablePalettes$() {
    return this.availablePalettes.asObservable();
  }

  setTheme(theme: 'light' | 'dark') {
    this._theme = theme;
    this.theme.next(theme);
    this.saveCurrentTheme();
    this.applyThemeColors();
  }

  setAccentColor(accent: string, complement?: string) {
    this.accentColor = accent;
    this.complementColor = complement || generateComplementaryColor(accent);
    this.paletteMode = 'custom';
    this.selectedPalette = undefined;
    this.saveCurrentTheme();
    this.applyThemeColors();
  }

  setPalette(paletteName: string) {
    let palette = getPaletteByName(paletteName);
    
    // If not found in predefined, check custom palettes
    if (!palette && isPlatformBrowser(this.platformId)) {
      const customPalettes = this.loadCustomPalettes();
      palette = customPalettes.find(p => p.name === paletteName);
    }
    
    if (palette) {
      this.selectedPalette = palette;
      this.accentColor = palette.accent;
      this.complementColor = palette.complementary;
      this.paletteMode = 'predefined';
      this.saveCurrentTheme();
      this.applyThemeColors();
    }
  }

  private loadCustomPalettes(): ColorPalette[] {
    if (!isPlatformBrowser(this.platformId)) {
      return [];
    }
    
    const saved = localStorage.getItem('customPalettes');
    return saved ? JSON.parse(saved) : [];
  }

  getTheme(): 'light' | 'dark' {
    return this._theme;
  }

  getAccentColor(): string {
    return this.accentColor;
  }

  getComplementaryColor(): string {
    return this.complementColor;
  }

  getCurrentPalette(): ColorPalette | undefined {
    return this.selectedPalette;
  }

  getPaletteMode(): 'custom' | 'predefined' {
    return this.paletteMode;
  }

  private saveCurrentTheme() {
    const themeData: SavedTheme = {
      theme: this._theme,
      accentColor: this.accentColor,
      complementColor: this.complementColor,
      paletteMode: this.paletteMode,
      paletteName: this.selectedPalette?.name
    };
    
    if (isPlatformBrowser(this.platformId)) {
      saveTheme(this.platformId, themeData);
    }
  }

  private applyThemeColors() {
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

    // Apply theme colors - using standardized naming convention
    document.documentElement.style.setProperty('--background', themeColors.background);
    document.documentElement.style.setProperty('--foreground', themeColors.foreground);
    document.documentElement.style.setProperty('--accent', themeColors.accent);
    document.documentElement.style.setProperty('--complement', themeColors.complementary);
    document.documentElement.style.setProperty('--tertiary', themeColors.tertiary);
    document.documentElement.style.setProperty('--success', themeColors.success);
    document.documentElement.style.setProperty('--danger', themeColors.danger);
    document.documentElement.style.setProperty('--warning', themeColors.warning);

    // Apply color shades
    this.applyColorShades('accent', themeColors.accentShades);
    this.applyColorShades('complement', themeColors.complementaryShades);
    this.applyColorShades('tertiary', themeColors.tertiaryShades);
    this.applyColorShades('success', themeColors.successShades);
    this.applyColorShades('danger', themeColors.dangerShades);
    this.applyColorShades('warning', themeColors.warningShades);

    // Apply gradients
    this.applyGradients('accent', themeColors.accentGradients);
    this.applyGradients('complement', themeColors.complementaryGradients);
    this.applyGradients('tertiary', themeColors.tertiaryGradients);
    this.applyGradients('success', themeColors.successGradients);
    this.applyGradients('danger', themeColors.dangerGradients);
    this.applyGradients('warning', themeColors.warningGradients);
  }

  private applyColorShades(colorName: string, shades: [string, string][]) {
    shades.forEach(([index, shade]) => {
      document.documentElement.style.setProperty(`--${colorName}-${index}`, shade);
    });
  }

  private applyGradients(colorName: string, gradients: { [key: string]: string }) {
    Object.entries(gradients).forEach(([gradientType, gradient]) => {
      document.documentElement.style.setProperty(`--${colorName}-gradient-${gradientType}`, gradient);
    });
  }

  private generateThemeColors(): ThemeColors {
    // Use palette colors if available, otherwise generate from accent
    let background = this._theme === 'light' ? '#ffffff' : '#1a1a2e';
    let foreground = this._theme === 'light' ? '#212121' : '#ffffff';

    if (this.selectedPalette) {
      if (this.selectedPalette.background) {
        background = this._theme === 'light' 
          ? this.selectedPalette.background.light 
          : this.selectedPalette.background.dark;
      }
      if (this.selectedPalette.foreground) {
        foreground = this._theme === 'light' 
          ? this.selectedPalette.foreground.light 
          : this.selectedPalette.foreground.dark;
      }
    }

    const accentShades = generateColorShades(this.accentColor);
    const complementaryShades = generateColorShades(this.complementColor);
    const tertiaryColor = this.selectedPalette?.tertiary || generateTertiaryColor(this.accentColor);
    const tertiaryShades = generateColorShades(tertiaryColor);
    const successColor = generateSuccessColor(this.accentColor);
    const successShades = generateColorShades(successColor);
    const dangerColor = generateDangerColor(this.accentColor);
    const dangerShades = generateColorShades(dangerColor);
    const warningColor = generateWarningColor(this.accentColor);
    const warningShades = generateColorShades(warningColor);

    return {
      background,
      foreground,
      accent: this.accentColor,
      accentShades,
      accentGradients: this.generateGradients(accentShades),
      complementary: this.complementColor,
      complementaryShades,
      complementaryGradients: this.generateGradients(complementaryShades),
      tertiary: tertiaryColor,
      tertiaryShades,
      tertiaryGradients: this.generateGradients(tertiaryShades),
      success: successColor,
      successShades,
      successGradients: this.generateGradients(successShades),
      danger: dangerColor,
      dangerShades,
      dangerGradients: this.generateGradients(dangerShades),
      warning: warningColor,
      warningShades,
      warningGradients: this.generateGradients(warningShades),
    };
  }

  private generateGradients(shades: [string, string][]): {
    [key: string]: string;
  } {
    return {
      light: `linear-gradient(135deg, ${shades[0][1]}, ${shades[1][1]}, ${shades[2][1]}, ${shades[3][1]}, ${shades[4][1]})`,
      dark: `linear-gradient(135deg, ${shades[5][1]}, ${shades[6][1]}, ${shades[7][1]}, ${shades[8][1]}, ${shades[9][1]})`,
      fastCycle: `linear-gradient(45deg, ${shades.map(([, shade]) => shade).join(', ')})`,
    };
  }
}
