import {
  ApplicationConfig,
  PLATFORM_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
import { AuthStateService } from './auth-state.service';

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
    // Session lives in an httpOnly cookie, so the only way to know whether the
    // user is signed in is to ask the gateway. Doing it at bootstrap — rather
    // than relying on whichever component happens to inject AuthStateService
    // first — means a hard page load, a deep link, or a refresh all resolve
    // auth before the first guard runs. Without it the app booted anonymous
    // even with a perfectly valid cookie.
    //
    // `provideAppInitializer`, not `APP_INITIALIZER`: the latter is deprecated
    // as of Angular 19 and this workspace is on 20.
    provideAppInitializer(() => {
      const platformId = inject(PLATFORM_ID);
      if (!isPlatformBrowser(platformId)) {
        return Promise.resolve();
      }
      return inject(AuthStateService).restoreSession();
    }),
  ],
};
