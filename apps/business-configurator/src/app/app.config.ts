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
import { APP_INITIALIZER } from '@angular/core';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { appRoutes } from './app.routes';
import { BusinessConfigStateService } from './state/business-config-state.service';
import { AuthStateService } from './state/auth-state.service';
import { AuthenticationService } from './services/authentication.service';
import { authenticationInterceptor } from './auth/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(
      withFetch(),
      withInterceptors([authenticationInterceptor])
    ),
    { provide: API_BASE_URL, useValue: '/api' },
    BusinessConfigStateService,
    AuthStateService,
    AuthenticationService,
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [AuthStateService],
      useFactory: (auth: AuthStateService) => () => auth.restoreSession(),
    },
  ],
};
