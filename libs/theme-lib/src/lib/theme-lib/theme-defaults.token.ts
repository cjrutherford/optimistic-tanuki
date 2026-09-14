import { InjectionToken } from '@angular/core';
import { ProductThemeDefaults } from '@optimistic-tanuki/theme-models';

/**
 * The theme an app starts in before its user has chosen one.
 */
export type ThemeDefaults = ProductThemeDefaults;

/**
 * App-level theme defaults read by `ThemeService`. A theme the user has saved
 * always takes precedence over these.
 */
export const THEME_DEFAULTS = new InjectionToken<ThemeDefaults>(
  'THEME_DEFAULTS'
);
