import { provideScenePersonality } from '@optimistic-tanuki/motion-ui';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
  inject,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { appRoutes } from './app.routes';
import { AuthSessionService } from './services/auth-session.service';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import {
  provideProductTheme,
  ThemeService,
} from '@optimistic-tanuki/theme-lib';

export const appConfig: ApplicationConfig = {
  providers: [
    provideScenePersonality(() => inject(ThemeService).personality$),
    provideProductTheme('configurable-client'),
    provideClientHydration(withEventReplay()),
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(withFetch()),
    { provide: API_BASE_URL, useValue: '/api' },
    { provide: 'API_BASE_URL', useValue: '/api' },
    AuthSessionService,
  ],
};
