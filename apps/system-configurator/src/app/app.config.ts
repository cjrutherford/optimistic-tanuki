import {
  ApplicationConfig,
  APP_INITIALIZER,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { appRoutes } from './app.routes';
import { authenticationInterceptor } from './auth/auth.interceptor';
import { AuthenticationService } from './services/authentication.service';
import { AuthStateService } from './state/auth-state.service';
import { ProfileService } from './state/profile.service';
import { ReturnIntentService } from './state/return-intent.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(
      withInterceptors([authenticationInterceptor]),
      withFetch()
    ),
    {
      provide: API_BASE_URL,
      useValue: '/api',
    },
    AuthStateService,
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [AuthStateService],
      useFactory: (auth: AuthStateService) => () => auth.restoreSession(),
    },
    AuthenticationService,
    ProfileService,
    ReturnIntentService,
    MessageService,
  ],
};
