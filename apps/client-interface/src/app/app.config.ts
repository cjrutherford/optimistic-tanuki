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
import { SOCKET_HOST, SOCKET_IO_INSTANCE, SOCKET_NAMESPACE } from '@optimistic-tanuki/chat-ui';
import { io } from 'socket.io-client';

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
        const value =
          (window as any)['env']?.SOCKET_URL || ':3300';
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
      provide: ErrorHandler,
      useClass: GlobalErrorHandler,
    },
    AuthStateService,
    AuthenticationService,
  ],
};
