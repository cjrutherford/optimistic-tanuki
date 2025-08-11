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


export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(withEventReplay()),
    provideHttpClient(withInterceptors([authenticationInterceptor])),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    {
      provide: SOCKET_HOST,
      useFactory: () => {
        const value = 'http://localhost:3300';
        console.log('Socket host URL:', value);
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
    AuthStateService,
    AuthenticationService,
    ProfileService,
    MessageService,
  ],
};
