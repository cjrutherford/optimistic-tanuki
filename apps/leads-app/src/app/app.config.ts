import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { appRoutes } from './app.routes';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { authInterceptor } from './http.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptors([authInterceptor]), withFetch()),
    provideAnimations(),
    {
      provide: API_BASE_URL,
      useValue: '/api',
    },
    ThemeService,
  ],
};
