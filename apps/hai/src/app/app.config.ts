import { provideScenePersonality } from '@optimistic-tanuki/motion-ui';
import {
  ApplicationConfig,
  provideZoneChangeDetection,
  inject,
} from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import {
  TitleStrategy,
  provideRouter,
  withInMemoryScrolling,
} from '@angular/router';
import { SeoTitleStrategy } from './services/seo-title.strategy';
import { appRoutes } from './app.routes';
import {
  FontLoadingService,
  ThemeService,
  provideProductTheme,
} from '@optimistic-tanuki/theme-lib';

export const appConfig: ApplicationConfig = {
  providers: [
    provideScenePersonality(() => inject(ThemeService).personality$),
    provideProductTheme('hai'),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch()),
    provideRouter(
      appRoutes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled',
      })
    ),
    ThemeService,
    { provide: TitleStrategy, useClass: SeoTitleStrategy },
    FontLoadingService,
  ],
};
