import {
  ApplicationConfig,
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  PLATFORM_ID,
  provideZoneChangeDetection,
} from '@angular/core';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import { io } from 'socket.io-client';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  SOCKET_HOST,
  SOCKET_IO_INSTANCE,
  SOCKET_NAMESPACE,
  SocketChatService,
} from '@optimistic-tanuki/chat-ui';
import { AuthStateService } from './auth-state.service';
import { AuthenticationService } from './authentication.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { ProfileService } from './profile/profile.service';
import { appRoutes } from './app.routes';
import { authenticationInterceptor } from './authentication.interceptor';
import { provideRouter } from '@angular/router';


/**
 * The main application configuration.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    /**
     * Provides client hydration with event replay.
     */
    provideClientHydration(withEventReplay()),
    /**
     * Provides HTTP client with authentication interceptor.
     */
    provideHttpClient(withInterceptors([authenticationInterceptor])),
    /**
     * Provides zone change detection with event coalescing.
     */
    provideZoneChangeDetection({ eventCoalescing: true }),
    /**
     * Provides routing for the application.
     */
    provideRouter(appRoutes),
    /**
     * Provides the socket host URL.
     */
    {
      provide: SOCKET_HOST,
      useFactory: () => {
        // const value = typeof window !== 'undefined' && window.location.origin
        //   ? window.location.origin
        //   : 'http://localhost:3300';
        const value = 'http://localhost:3300';
        console.log('Socket host URL:', value);
        return value;
      },
    },
    /**
     * Provides the socket namespace.
     */
    {
      provide: SOCKET_NAMESPACE,
      useValue: 'chat',
    },
    /**
     * Provides the Socket.IO instance.
     */
    {
      provide: SOCKET_IO_INSTANCE,
      useValue: io,
    },
    /**
     * Provides the SocketChatService.
     */
    SocketChatService,
    /**
     * Provides the AuthStateService.
     */
    AuthStateService,
    /**
     * Provides the AuthenticationService.
     */
    AuthenticationService,
    /**
     * Provides the ProfileService.
     */
    ProfileService,
    /**
     * Provides the MessageService.
     */
    MessageService,
  ],
};
