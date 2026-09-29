import { provideScenePersonality } from '@optimistic-tanuki/motion-ui';
import {
  ApplicationConfig,
  provideZoneChangeDetection,
  inject,
} from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import {
  FontLoadingService,
  ThemeService,
  provideProductTheme,
} from '@optimistic-tanuki/theme-lib';

export const appConfig: ApplicationConfig = {
  providers: [
    provideScenePersonality(() => inject(ThemeService).personality$),
    provideProductTheme('hai'),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withFetch()),
    provideRouter(appRoutes),
    ThemeService,
    FontLoadingService,
  ],
};
