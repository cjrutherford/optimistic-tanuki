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

export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(withEventReplay()),
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(withFetch(), withInterceptors([LearningInterceptor])),
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
