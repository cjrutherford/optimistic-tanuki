import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

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
    AuthStateService,
    AuthenticationService,
    ProfileService,
    MessageService,
  ],
};
