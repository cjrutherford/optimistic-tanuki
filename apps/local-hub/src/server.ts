import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine, isMainModule } from '@angular/ssr/node';
import { createProxyMiddleware } from 'http-proxy-middleware';
import express from 'express';
import { oauthCallbackReferrerPolicy } from '@optimistic-tanuki/auth-ui';
import cookieParser from 'cookie-parser';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bootstrap from './main.server';
import { createGatewaySessionValidator } from './server-session-validation';
import { createProtectedRouteGate } from './server-route-guard';
import { startNodeRuntimeMonitoring } from '@optimistic-tanuki/common-ui/node-performance-monitor';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
const indexHtml = join(serverDistFolder, 'index.server.html');

const app = express();
app.use(oauthCallbackReferrerPolicy);
const commonEngine = new CommonEngine();

const gatewayUrl = process.env['GATEWAY_URL'] || 'http://gateway:3000';
startNodeRuntimeMonitoring({
  appId: 'local-hub',
  gatewayEndpoint: gatewayUrl,
  otlpEndpoint: process.env['OTEL_EXPORTER_OTLP_ENDPOINT'],
});
const gatewayWsUrl = process.env['GATEWAY_WS_URL'] || 'http://gateway:3300';
const validateGatewaySession = createGatewaySessionValidator({ gatewayUrl });
const getRequestUrl = (req: express.Request): string => {
  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  const host = forwardedHost || req.get('host') || 'localhost';
  return `${protocol}://${host}${req.originalUrl}`;
};

app.use(cookieParser());

app.use(
  '/socket.io',
  createProxyMiddleware({
    target: gatewayWsUrl,
    ws: true,
    changeOrigin: true,
  })
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
    changeOrigin: true,
  })
);

app.use(createProtectedRouteGate({ validateSession: validateGatewaySession }));

app.get(
  '**',
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: 'index.html',
  })
);

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
    .then((html) => res.send(html))
    .catch((err) => next(err));
});

if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4201;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export default app;
