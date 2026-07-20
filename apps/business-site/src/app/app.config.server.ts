import {
  mergeApplicationConfig,
  ApplicationConfig,
  CSP_NONCE,
} from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { getRequestCspNonce } from '../csp-nonce';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // Ties Angular's inline-style renderer (SharedStylesHost) to the same
    // per-request nonce that server.ts sends in the CSP header, so that
    // component <style> tags emitted during SSR carry a matching nonce
    // instead of relying on 'unsafe-inline'.
    { provide: CSP_NONCE, useFactory: getRequestCspNonce },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
