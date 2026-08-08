import {
  ApplicationConfig,
  APP_INITIALIZER,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { businessHttpInterceptor } from '@optimistic-tanuki/business-data-access';
import { appRoutes } from './app.routes';
import { BusinessAuthService } from '@optimistic-tanuki/business-data-access';
import { firstValueFrom } from 'rxjs';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      appRoutes,
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled',
      })
    ),
    provideHttpClient(withFetch(), withInterceptors([businessHttpInterceptor])),
    provideAnimations(),
    { provide: API_BASE_URL, useValue: '/api' },
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [BusinessAuthService],
      useFactory: (auth: BusinessAuthService) => () =>
        firstValueFrom(auth.restoreSession()),
    },
  ],
};
