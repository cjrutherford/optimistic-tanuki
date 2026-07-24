import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import { dirname, resolve } from 'node:path';

import { createProxyMiddleware } from 'http-proxy-middleware';
import express, { NextFunction, Request, Response } from 'express';
import { oauthCallbackReferrerPolicy } from '@optimistic-tanuki/auth-ui';
import { fileURLToPath } from 'node:url';
import { createSocketIoProxyOptions } from './server-proxy';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
app.use(oauthCallbackReferrerPolicy);
const angularApp = new AngularNodeAppEngine();

const gatewayUrl = process.env['GATEWAY_URL'] || 'http://gateway:3000';
const gatewayWsUrl = process.env['GATEWAY_WS_URL'] || 'http://gateway:3300';
const runtimeSocketEnvironment = JSON.stringify({
  SOCKET_URL: process.env['SOCKET_URL'] || '',
  SOCKET_PATH: process.env['SOCKET_PATH'] || '/socket.io',
}).replace(/</g, '\\u003c');

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/**', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  })
);

app.use(
  '/socket.io',
  createProxyMiddleware(createSocketIoProxyOptions(gatewayWsUrl))
);
app.use(
  '/chat',
  createProxyMiddleware({
    target: gatewayWsUrl,
    ws: true,
    changeOrigin: true,
  })
);

app.use(
  '/api',
  createProxyMiddleware({
    target: `${gatewayUrl}/api`,
    ws: true,
    changeOrigin: true,
  })
);
/**
 * Handle all other requests by rendering the Angular application.
 */
app.use('/**', (req, res, next) => {
  angularApp
    .handle(req, {
      document: (html: string) => {
        const envScript = `<script>window['env'] = ${runtimeSocketEnvironment};</script>`;
        const finalDoc = html.replace('</body>', `${envScript}</body>`);
        return finalDoc;
      },
    })
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next()
    )
    .catch(next);
});

/**
 * Keep track of errors for debugging purposes.
 */

app.use((err: unknown, req: Request, _res: Response, next: NextFunction) => {
  console.error('Unhandled exception in Express server', {
    url: req.url,
    ip: req.ip,
    err,
  });
  next(err);
});

/**
 * Start the server if this module is the main entry point.
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
