import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideClientHydration } from '@angular/platform-browser';
import { appRoutes } from './app.routes';
import { provideProductTheme } from '@optimistic-tanuki/theme-lib';

export const appConfig: ApplicationConfig = {
  providers: [
    provideProductTheme('setup-console'),
    provideRouter(appRoutes),
    provideHttpClient(withFetch()),
    provideClientHydration(),
  ],
};
