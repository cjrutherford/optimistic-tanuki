import { provideServerRendering, withRoutes } from '@angular/ssr';
import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { appConfig } from './app.config';
import serverRoutes from './app.routes.server';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { getServerApiBaseUrl } from '../server-api-base-url';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    {
      provide: API_BASE_URL,
      useValue: getServerApiBaseUrl(
        process.env['GATEWAY_URL'] || 'http://gateway:3000'
      ),
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
