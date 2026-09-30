import { provideScenePersonality } from '@optimistic-tanuki/motion-ui';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
  inject,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { appRoutes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import {
  provideProductTheme,
  ThemeService,
} from '@optimistic-tanuki/theme-lib';

export const appConfig: ApplicationConfig = {
  providers: [
    provideScenePersonality(() => inject(ThemeService).personality$),
    provideProductTheme('video-client'),
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
  ],
};
