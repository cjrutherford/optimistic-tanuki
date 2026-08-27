import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { appRoutes } from './app.routes';
import { LearningInterceptor } from './learning.interceptor';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import { isDevMode } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

export const appConfig: ApplicationConfig = {
  providers: [
    // provideClientHydration() enables the HTTP transfer cache by default:
    // any GET the server makes is captured into TransferState and the
    // browser's identical GET on hydration replays it instead of refetching.
    // That covers catalog() and subjects() below without any extra config.
    provideClientHydration(withEventReplay()),
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(withFetch(), withInterceptors([LearningInterceptor])),
    { provide: API_BASE_URL, useValue: '/api' },
    /*
      Registration waits until the app is stable, so a first visit is not
      competing with the worker for the network. It is off in development,
      where a worker caching a half-built bundle is only ever a nuisance.

      This is safe under server rendering: provideServiceWorker checks for a
      browser before it touches navigator.
    */
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
