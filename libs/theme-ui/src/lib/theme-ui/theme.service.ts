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
import { loadTheme, saveTheme } from './theme-storage';
import { ThemeColors } from './theme.interface';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private _theme: 'light' | 'dark';
  private accentColor: string;
  private complementColor?: string;
  theme: BehaviorSubject<'light' | 'dark' | undefined> = new BehaviorSubject<'light' | 'dark' | undefined>(undefined);
  private themeColors: BehaviorSubject<ThemeColors | undefined> = new BehaviorSubject<ThemeColors | undefined>(undefined);

  constructor(@Inject(PLATFORM_ID) private platformId: object) {
    if(isPlatformBrowser(this.platformId)) {
      const storedTheme = loadTheme(this.platformId);
      this._theme = storedTheme.theme;
      this.accentColor = storedTheme.accentColor;

      this.theme.next(this._theme);
      // The call to generateThemeColors and applyThemeColors is already guarded
      this.themeColors.next(this.generateThemeColors());
      this.applyThemeColors();
   } else {
    // Initialize default values for SSR, actual application of these will be skipped if not browser
    this._theme = 'light';
    this.accentColor = '#3f51b5';
    this.theme.next(this._theme);
    // themeColors will be based on these defaults for SSR if needed by other logic
    this.themeColors.next(this.generateThemeColors());
   }
  }

  theme$() {
    return this.theme.asObservable();
  }
  setTheme(theme: 'light' | 'dark') {
    this._theme = theme;
    this.theme.next(theme);
    if (isPlatformBrowser(this.platformId)) {
      saveTheme(this.platformId, theme, this.accentColor, this.complementColor || generateComplementaryColor(this.accentColor));
      document.documentElement.style.setProperty(
        '--background-color',
        theme === 'light' ? '#fff' : '#333',
      );
      document.documentElement.style.setProperty(
        '--foreground-color',
        theme === 'light' ? '#333' : '#fff',
      );
      this.applyThemeColors();
    } else {
      // For SSR, update themeColors if other parts of the app might read it
      this.themeColors.next(this.generateThemeColors());
    }
  }

  setAccentColor(accent: string, complement?: string) {
    this.accentColor = accent;
    this.complementColor = complement;
    if (isPlatformBrowser(this.platformId)) {
      saveTheme(this.platformId, this._theme, accent, complement || generateComplementaryColor(accent));
      this.applyThemeColors();
    } else {
      // For SSR, update themeColors if other parts of the app might read it
      this.themeColors.next(this.generateThemeColors());
    }
  }

  getTheme(): 'light' | 'dark' {
    return this._theme;
  }

  getAccentColor(): string {
    return this.accentColor;
  }

  get themeColors$() {
    return this.themeColors.asObservable();
  }

  private applyThemeColors() {
    const themeColors = this.generateThemeColors();
    this.themeColors.next(themeColors);
    if (!isPlatformBrowser(this.platformId)) {
      // If not in browser, we don't apply styles
      return;
    }
    // This method is now only called if isPlatformBrowser is true
    document.documentElement.style.setProperty(
      '--background-color',
      themeColors.background,
    );
    document.documentElement.style.setProperty(
      '--foreground-color',
      themeColors.foreground,
    );
    document.documentElement.style.setProperty(
      '--accent-color',
      themeColors.accent,
    );
    document.documentElement.style.setProperty(
      '--tertiary-color',
      themeColors.tertiaryShades[2][1],
    );

    // themeColors.accentShades.forEach(([index, shade]: [string, string]) => {
    //   document.documentElement.style.setProperty(
    //     `--accent-shade-${index}`,
    //     shade,
    //   );
    // });
    // Object.keys(themeColors.accentGradients).forEach((subKey) => {
    //   document.documentElement.style.setProperty(
    //     `--accent-gradient-${subKey}`,
    //     themeColors.accentGradients[subKey],
    //   );
    // });

    // document.documentElement.style.setProperty(
    //   '--complementary-color',
    //   themeColors.complementary,
    // );
    // themeColors.complementaryShades.forEach(([index, shade]: [string, string]) => {
    //   document.documentElement.style.setProperty(
    //     `--complementary-shade-${index}`,
    //     shade,
    //   );
    // });
    // Object.keys(themeColors.complementaryGradients).forEach((subKey) => {
    //   document.documentElement.style.setProperty(
    //     `--complementary-gradient-${subKey}`,
    //     themeColors.complementaryGradients[subKey],
    //   );
    // });

    // document.documentElement.style.setProperty(
    //   '--success-color',
    //   themeColors.success,
    // );
    // themeColors.successShades.forEach(([index, shade]: [string, string]) => {
    //   document.documentElement.style.setProperty(
    //     `--success-shade-${index}`,
    //     shade,
    //   );
    // });
    // Object.keys(themeColors.successGradients).forEach((subKey) => {
    //   document.documentElement.style.setProperty(
    //     `--success-gradient-${subKey}`,
    //     themeColors.successGradients[subKey],
    //   );
    // });

    // document.documentElement.style.setProperty(
    //   '--danger-color',
    //   themeColors.danger,
    // );
    // themeColors.dangerShades.forEach(([index, shade]: [string, string]) => {
    //   document.documentElement.style.setProperty(
    //     `--danger-shade-${index}`,
    //     shade,
    //   );
    // });
    // Object.keys(themeColors.dangerGradients).forEach((subKey) => {
    //   document.documentElement.style.setProperty(
    //     `--danger-gradient-${subKey}`,
    //     themeColors.dangerGradients[subKey],
    //   );
    // });

    // document.documentElement.style.setProperty(
    //   '--warning-color',
    //   themeColors.warning,
    // );
    // themeColors.warningShades.forEach(([index, shade]: [string, string]) => {
    //   document.documentElement.style.setProperty(
    //     `--warning-shade-${index}`,
    //     shade,
    //   );
    // });
    // Object.keys(themeColors.warningGradients).forEach((subKey) => {
    //   document.documentElement.style.setProperty(
    //     `--warning-gradient-${subKey}`,
    //     themeColors.warningGradients[subKey],
    //   );
    // });
  }

  private generateThemeColors(): ThemeColors {
    const accentShades = generateColorShades(this.accentColor);
    const complementaryColor = this.complementColor ? this.complementColor : generateComplementaryColor(this.accentColor);
    const complementaryShades = generateColorShades(complementaryColor);
    const tertiaryColor = generateTertiaryColor(this.accentColor);
    const successColor = generateSuccessColor(this.accentColor);
    const successShades = generateColorShades(successColor);
    const dangerColor = generateDangerColor(this.accentColor);
    const dangerShades = generateColorShades(dangerColor);
    const warningColor = generateWarningColor(this.accentColor);
    const warningShades = generateColorShades(warningColor);

    return {
      background: this._theme === 'light' ? '#fff' : '#333',
      foreground: this._theme === 'light' ? '#333' : '#fff',
      accent: this.accentColor,
      accentShades,
      accentGradients: this.generateGradients(accentShades),
      complementary: complementaryColor,
      complementaryShades,
      complementaryGradients: this.generateGradients(complementaryShades),
      tertiary: tertiaryColor,
      tertiaryShades: generateColorShades(tertiaryColor),
      tertiaryGradients: this.generateGradients(generateColorShades(tertiaryColor)),
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
    const cycles = Array.from({ length: 5 }, (_, i) => i);
    return {
      light: `linear-gradient(135deg, ${shades[0][1]}, ${shades[1][1]}, ${shades[2][1]}, ${shades[3][1]}, ${shades[4][1]})`,
      dark: `linear-gradient(135deg, ${shades[5][1]}, ${shades[6][1]}, ${shades[7][1]}, ${shades[8][1]}, ${shades[9][1]})`,
      fastCycle: `linear-gradient(45deg, ${cycles.map(() => shades.map(([, shade]) => shade)).join(', ')})`,
    };
  }
}
