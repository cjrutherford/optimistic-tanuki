import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import { dirname, resolve } from 'node:path';

import { createProxyMiddleware } from 'http-proxy-middleware';
import express from 'express';
import { fileURLToPath } from 'node:url';

/**
 * The directory containing the server-side build output.
 */
const serverDistFolder = dirname(fileURLToPath(import.meta.url));
/**
 * The directory containing the browser-side build output.
 */
const browserDistFolder = resolve(serverDistFolder, '../browser');

/**
 * The Express application instance.
 */
const app = express();
/**
 * The Angular Node.js application engine for server-side rendering.
 */
const angularApp = new AngularNodeAppEngine();

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/**', (req, res) => {
 *   // Handle API request
 * * });
 * ```
 */

/**
 * Serves static files from the browser build output directory.
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  })
);

/**
 * Proxies WebSocket connections for /socket.io to the gateway service.
 */
app.use(
  '/socket.io',
  createProxyMiddleware({
    target: 'http://gateway:3300',
    ws: true,
    changeOrigin: true,
  })
);
/**
 * Proxies WebSocket connections for /chat to the gateway service.
 */
app.use(
  '/chat',
  createProxyMiddleware({
    target: 'http://gateway:3300', 
    ws: true,
    changeOrigin: true,
  })
);

/**
 * Proxies API requests to the gateway service.
 */
app.use(
  '/api',
  createProxyMiddleware({
    target: 'http://gateway:3000/api',
    ws: true,
    changeOrigin: true,
  })
);
/**
 * Handles all other requests by rendering the Angular application.
 */
app.use('/**', (req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next()
    )
    .catch(next);
});

/**
 * Starts the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
