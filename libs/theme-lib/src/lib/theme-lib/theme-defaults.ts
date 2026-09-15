import {
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { getProductThemeDefaults } from '@optimistic-tanuki/theme-models';
import { THEME_DEFAULTS, ThemeDefaults } from './theme-defaults.token';
import { ThemeService } from './theme.service';

export { THEME_DEFAULTS, type ThemeDefaults } from './theme-defaults.token';

/**
 * Give the app a default personality, mode, and primary colour.
 *
 * The defaults apply on first load and whenever the user has no saved theme;
 * once the user picks a personality or mode (theme toggle, personality
 * selector, theme designer) their choice is saved and wins on later loads.
 * The theme service is created during app initialization so the theme is on
 * the page before the first component renders.
 */
export function provideThemeDefaults(
  defaults: ThemeDefaults
): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: THEME_DEFAULTS, useValue: defaults },
    provideAppInitializer(() => {
      inject(ThemeService);
    }),
  ]);
}

/**
 * Apply the defaults declared for an Nx project in `PRODUCT_THEME_DEFAULTS`.
 */
export function provideProductTheme(projectName: string): EnvironmentProviders {
  return provideThemeDefaults(getProductThemeDefaults(projectName));
}
