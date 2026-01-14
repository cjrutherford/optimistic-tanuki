import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
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

export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(withEventReplay()),
    provideHttpClient(
      withInterceptors([authenticationInterceptor]),
      withFetch()
    ),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    {
      provide: API_BASE_URL,
      useValue: '/api',
    },
    {
      provide: SOCKET_HOST,
      useFactory: () => {
        const value =
          (window as any)['env']?.SOCKET_URL || 'http://localhost:3300';
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
    AuthStateService,
    AuthenticationService,
    ProfileService,
    MessageService,
  ],
};
