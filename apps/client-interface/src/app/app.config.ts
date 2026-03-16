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
  SOCKET_AUTH_TOKEN_PROVIDER,
  SOCKET_AUTH_ERROR_HANDLER,
} from '@optimistic-tanuki/chat-ui';
import { io } from 'socket.io-client';
import { Router } from '@angular/router';

export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideAnimationsAsync(),
    provideHttpClient(
      withInterceptors([AuthInterceptor, errorInterceptor]),
      withFetch()
    ),
    {
      provide: API_BASE_URL,
      useValue: '/api',
    },
    {
      provide: SOCKET_HOST,
      useFactory: () => {
        const value = (window as any)['env']?.SOCKET_URL || ':3300';
        return value;
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
