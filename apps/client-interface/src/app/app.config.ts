import {
  ApplicationConfig,
  importProvidersFrom,
  provideZoneChangeDetection,
  ErrorHandler,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
  provideHttpClient,
  withInterceptors,
  HttpHandlerFn,
  HttpRequest,
  withFetch,
} from '@angular/common/http';
import { AuthStateService } from './state/auth-state.service';
import { AuthenticationService } from './authentication.service';
import { AuthInterceptor } from './http.interceptor';
import { errorInterceptor } from './http.error-interceptor';
import { GlobalErrorHandler } from './global-error-handler';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import {
  SOCKET_HOST,
  SOCKET_IO_INSTANCE,
  SOCKET_NAMESPACE,
  SOCKET_PATH,
  SOCKET_AUTH_TOKEN_PROVIDER,
  SOCKET_AUTH_ERROR_HANDLER,
} from '@optimistic-tanuki/chat-ui';
import { io } from 'socket.io-client';
import { Router } from '@angular/router';
import { APP_ENV } from '../environments/app-env';

export const appConfig: ApplicationConfig = {
  providers: [
    // Hydration only applies to the SSR web build; the mobile bundle is pure CSR.
    ...(APP_ENV.mobile ? [] : [provideClientHydration()]),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideAnimationsAsync(),
    provideHttpClient(
      withInterceptors([AuthInterceptor, errorInterceptor]),
      withFetch()
    ),
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
    {
      provide: ErrorHandler,
      useClass: GlobalErrorHandler,
    },
    AuthStateService,
    AuthenticationService,
  ],
};
