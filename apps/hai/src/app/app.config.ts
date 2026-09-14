import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
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
    provideProductTheme('hai'),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withFetch()),
    provideRouter(appRoutes),
    ThemeService,
    FontLoadingService,
  ],
};
