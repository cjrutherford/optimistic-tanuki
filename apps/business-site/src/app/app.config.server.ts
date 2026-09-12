import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

const serverApiBaseUrl = `${(
  process.env['GATEWAY_URL'] || 'http://gateway:3000'
).replace(/\/$/, '')}/api`;

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    { provide: API_BASE_URL, useValue: serverApiBaseUrl },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
