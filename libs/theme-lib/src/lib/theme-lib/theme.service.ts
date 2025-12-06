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
import { STANDARD_THEME_VARIABLES, getAllVariableNames } from './theme-config';

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
      // Initialize available palettes including custom ones
      this.updateAvailablePalettes();
      
      const storedTheme = loadTheme(this.platformId);
      this._theme = storedTheme.theme;
      this.accentColor = storedTheme.accentColor;
      this.complementColor = storedTheme.complementColor;
      this.paletteMode = storedTheme.paletteMode;
      
      if (this.paletteMode === 'predefined' && storedTheme.paletteName) {
        this.selectedPalette = getPaletteByName(storedTheme.paletteName);
        if (!this.selectedPalette) {
          // Check in custom palettes
          const customPalettes = this.loadCustomPalettes();
          this.selectedPalette = customPalettes.find(p => p.name === storedTheme.paletteName);
          // If found in custom palettes, it's not actually predefined
          if (this.selectedPalette) {
            this.paletteMode = 'custom';
          }
        }
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

  private saveCustomPalettes(palettes: ColorPalette[]): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    
    localStorage.setItem('customPalettes', JSON.stringify(palettes));
    this.updateAvailablePalettes();
  }

  private updateAvailablePalettes(): void {
    const customPalettes = this.loadCustomPalettes();
    const allPalettes = [...PREDEFINED_PALETTES, ...customPalettes];
    this.availablePalettes.next(allPalettes);
  }

  getAllPalettes(): ColorPalette[] {
    return [...PREDEFINED_PALETTES, ...this.loadCustomPalettes()];
  }

  createCustomPalette(palette: ColorPalette): void {
    const customPalettes = this.loadCustomPalettes();
    
    // Check if palette with same name already exists
    if (customPalettes.some(p => p.name === palette.name) || 
        PREDEFINED_PALETTES.some(p => p.name === palette.name)) {
      throw new Error(`Palette with name "${palette.name}" already exists`);
    }
    
    customPalettes.push(palette);
    this.saveCustomPalettes(customPalettes);
  }

  updateCustomPalette(originalName: string, updatedPalette: ColorPalette): void {
    const customPalettes = this.loadCustomPalettes();
    const index = customPalettes.findIndex(p => p.name === originalName);
    
    if (index === -1) {
      throw new Error(`Palette with name "${originalName}" not found`);
    }
    
    // Check if new name conflicts with another palette
    if (originalName !== updatedPalette.name) {
      if (customPalettes.some((p, i) => i !== index && p.name === updatedPalette.name) ||
          PREDEFINED_PALETTES.some(p => p.name === updatedPalette.name)) {
        throw new Error(`Palette with name "${updatedPalette.name}" already exists`);
      }
    }
    
    customPalettes[index] = updatedPalette;
    this.saveCustomPalettes(customPalettes);
    
    // If currently using this palette, update the active theme
    if (this.selectedPalette?.name === originalName) {
      this.setPalette(updatedPalette.name);
    }
  }

  deleteCustomPalette(name: string): void {
    const customPalettes = this.loadCustomPalettes();
    const filtered = customPalettes.filter(p => p.name !== name);
    
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

    // Apply theme colors using standardized names with backward compatibility
    this.setThemeVariable(STANDARD_THEME_VARIABLES.BACKGROUND, themeColors.background);
    this.setThemeVariable(STANDARD_THEME_VARIABLES.FOREGROUND, themeColors.foreground);
    this.setThemeVariable(STANDARD_THEME_VARIABLES.ACCENT, themeColors.accent);
    this.setThemeVariable(STANDARD_THEME_VARIABLES.COMPLEMENT, themeColors.complementary);
    this.setThemeVariable(STANDARD_THEME_VARIABLES.TERTIARY, themeColors.tertiary);
    this.setThemeVariable(STANDARD_THEME_VARIABLES.SUCCESS, themeColors.success);
    this.setThemeVariable(STANDARD_THEME_VARIABLES.DANGER, themeColors.danger);
    this.setThemeVariable(STANDARD_THEME_VARIABLES.WARNING, themeColors.warning);

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

  /**
   * Set a theme variable with support for both standard and legacy names
   * This ensures backward compatibility while promoting standardized usage
   */
  private setThemeVariable(standardVariable: string, value: string) {
    const allNames = getAllVariableNames(standardVariable);
    allNames.forEach(varName => {
      document.documentElement.style.setProperty(varName, value);
    });
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
