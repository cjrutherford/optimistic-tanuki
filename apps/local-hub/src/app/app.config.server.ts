import { provideServerRendering, withRoutes } from '@angular/ssr';
import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { appConfig } from './app.config';
import serverRoutes from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    {
      // SSR cannot resolve the browser-relative /api URL; call the internal
      // gateway directly while the browser continues to use the local proxy.
      provide: API_BASE_URL,
      useValue: `${process.env['GATEWAY_URL'] || 'http://gateway:3000'}/api`,
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
