import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine, isMainModule } from '@angular/ssr/node';
import { createProxyMiddleware } from 'http-proxy-middleware';
import express from 'express';
import { oauthCallbackReferrerPolicy } from '@optimistic-tanuki/auth-ui';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bootstrap from './main.server';
import {
  createApiProxyOptions,
  createSocketIoProxyOptions,
} from './server-proxy';
import { startNodeRuntimeMonitoring } from '@optimistic-tanuki/common-ui/node-performance-monitor';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
const indexHtml = join(serverDistFolder, 'index.server.html');

const app = express();
app.use(oauthCallbackReferrerPolicy);
const commonEngine = new CommonEngine();

const gatewayUrl = process.env['GATEWAY_URL'] || 'http://gateway:3000';
startNodeRuntimeMonitoring({
  appId: 'client-interface',
  gatewayEndpoint: gatewayUrl,
  otlpEndpoint: process.env['OTEL_EXPORTER_OTLP_ENDPOINT'],
});
const gatewayWsUrl = process.env['GATEWAY_WS_URL'] || 'http://gateway:3300';
const configuredSocketUrl = process.env['SOCKET_URL'] || '';
const runtimeSocketEnvironment = JSON.stringify({
  // A relative value is a reverse-proxy route, not a Socket.IO host. The
  // browser client appends its namespace to SOCKET_URL, so forwarding `/ws`
  // would request the invalid `/ws/chat` namespace.
  SOCKET_URL: configuredSocketUrl.startsWith('/') ? '' : configuredSocketUrl,
  SOCKET_PATH: process.env['SOCKET_PATH'] || '/socket.io',
}).replace(/</g, '\\u003c');

const getRequestUrl = (req: express.Request): string => {
  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  const host = forwardedHost || req.get('host') || 'localhost';
  return `${protocol}://${host}${req.originalUrl}`;
};

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
 */ app.use(
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
app.use('/api', createProxyMiddleware(createApiProxyOptions(gatewayUrl)));

/**
 * Serve static files from /browser
 */
app.get(
  '**',
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: 'index.html',
  })
);

/**
 * Handle all other requests by rendering the Angular application.
 */
//tslint:disable-next-line:no-implicit-any
app.get('**', (req, res, next) => {
  const { baseUrl } = req;

  commonEngine
    .render({
      bootstrap,
      documentFilePath: indexHtml,
      url: getRequestUrl(req),
      publicPath: browserDistFolder,
      providers: [{ provide: APP_BASE_HREF, useValue: baseUrl }],
    })
    .then((html) =>
      res.send(
        html.replace(
          '</body>',
          `<script>window['env'] = ${runtimeSocketEnvironment};</script></body>`
        )
      )
    )
    .catch((err) => next(err));
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

export default app;
