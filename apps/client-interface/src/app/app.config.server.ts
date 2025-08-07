import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { appConfig } from './app.config';

/**
 * Server-specific application configuration.
 */
const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering()],
};

/**
 * Merged application configuration for both client and server.
 */
export const config = mergeApplicationConfig(appConfig, serverConfig);
