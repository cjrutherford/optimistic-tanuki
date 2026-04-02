import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';
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
    provideClientHydration(),
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptors([authenticationInterceptor]), withFetch()),
    {
      provide: API_BASE_URL,
      useValue: '/api',
    },
    AuthStateService,
    AuthenticationService,
    ProfileService,
    ReturnIntentService,
    MessageService,
  ],
};
