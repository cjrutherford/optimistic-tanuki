import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import { appRoutes } from './app.routes';
import { FontLoadingService, ThemeService } from '@optimistic-tanuki/theme-lib';
import { provideReturnLinkHandling } from '@optimistic-tanuki/app-registry';

export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(withEventReplay()),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withFetch()),
    provideRouter(appRoutes),
    provideReturnLinkHandling(),
    ThemeService,
    FontLoadingService,
  ],
};
