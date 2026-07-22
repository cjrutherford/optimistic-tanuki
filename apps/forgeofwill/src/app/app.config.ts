import {
  ApplicationConfig,
  inject,
  provideZoneChangeDetection,
} from '@angular/core';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import { io } from 'socket.io-client';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import {
  SOCKET_HOST,
  SOCKET_IO_INSTANCE,
  SOCKET_NAMESPACE,
  SOCKET_PATH,
  SOCKET_AUTH_TOKEN_PROVIDER,
  SOCKET_AUTH_ERROR_HANDLER,
} from '@optimistic-tanuki/chat-ui';
import { AuthStateService } from './auth-state.service';
import { AuthenticationService } from './authentication.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { ProfileService } from './profile/profile.service';
import { appRoutes } from './app.routes';
import { authenticationInterceptor } from './authentication.interceptor';
import { provideRouter, Router } from '@angular/router';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { APP_ENV } from '../environments/app-env';

export const appConfig: ApplicationConfig = {
  providers: [
    // Hydration only applies to the SSR web build; the mobile bundle is pure CSR.
    ...(APP_ENV.mobile ? [] : [provideClientHydration(withEventReplay())]),
    provideHttpClient(
      withInterceptors([authenticationInterceptor]),
      withFetch()
    ),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    {
      provide: API_BASE_URL,
      useValue: APP_ENV.apiBaseUrl,
    },
    {
      provide: SOCKET_HOST,
      useFactory: () => {
        return typeof window === 'undefined'
          ? ''
          : (window as any)['env']?.SOCKET_URL || APP_ENV.socketUrl;
      },
    },
    {
      provide: SOCKET_PATH,
      useFactory: () => {
        return typeof window === 'undefined'
          ? '/socket.io'
          : (window as any)['env']?.SOCKET_PATH || APP_ENV.socketPath;
      },
    },
    {
      provide: SOCKET_NAMESPACE,
      useValue: 'chat',
    },
    {
      provide: SOCKET_IO_INSTANCE,
      useValue: io,
    },
    {
      provide: SOCKET_AUTH_TOKEN_PROVIDER,
      useFactory: (authStateService: AuthStateService) => {
        return () => authStateService.getToken();
      },
      deps: [AuthStateService],
    },
    {
      provide: SOCKET_AUTH_ERROR_HANDLER,
      useFactory: (router: Router, authStateService: AuthStateService) => {
        return () => {
          console.warn(
            'WebSocket authentication failed - logging out and redirecting to login'
          );
          authStateService.logout();
          router.navigate(['/login']);
        };
      },
      deps: [Router, AuthStateService],
    },
    AuthStateService,
    AuthenticationService,
    ProfileService,
    MessageService,
  ],
};
