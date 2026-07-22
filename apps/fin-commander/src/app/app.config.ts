import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { provideRouter } from '@angular/router';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { errorInterceptor } from './http.error-interceptor';
import { appRoutes } from './app.routes';
import { FontLoadingService, ThemeService } from '@optimistic-tanuki/theme-lib';
import { AuthInterceptor } from './http.interceptor';
import { financeAppScopeInterceptor } from './finance-appscope.interceptor';
import { APP_ENV } from '../environments/app-env';

export const appConfig: ApplicationConfig = {
  providers: [
    // Hydration only applies to the SSR web build; the mobile bundle is pure CSR.
    ...(APP_ENV.mobile ? [] : [provideClientHydration(withEventReplay())]),
    provideHttpClient(
      withInterceptors([
        AuthInterceptor,
        financeAppScopeInterceptor,
        errorInterceptor,
      ]),
      withFetch()
    ),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    {
      provide: API_BASE_URL,
      useValue: APP_ENV.apiBaseUrl,
    },
    ThemeService,
    FontLoadingService,
  ],
};
