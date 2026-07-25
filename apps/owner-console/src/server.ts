import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import { createProxyMiddleware } from 'http-proxy-middleware';
import express from 'express';
import { oauthCallbackReferrerPolicy } from '@optimistic-tanuki/auth-ui';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authorizeOwnerConsoleAdminRequest } from './admin-api-authorization';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
app.use(oauthCallbackReferrerPolicy);
const angularApp = new AngularNodeAppEngine();

const gatewayUrl = process.env['GATEWAY_URL'] || 'http://gateway:3000';
const gatewayWsUrl = process.env['GATEWAY_WS_URL'] || 'http://gateway:3300';
const adminApiUrl =
  process.env['ADMIN_API_URL'] ||
  process.env['ADMIN_ENV_API_URL'] ||
  'http://admin-api:8098';
const ownerConsoleJwtSecret =
  process.env['OWNER_CONSOLE_JWT_SECRET'] || process.env['JWT_SECRET'];
const getRequestUrl = (req: express.Request): string => {
  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  const host = forwardedHost || req.get('host') || 'localhost';
  return `${protocol}://${host}${req.originalUrl}`;
};

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
    headers: {
      'x-ot-appscope': 'owner-console',
    },
  })
);

// Bootstrap operations must never be exposed through the public Owner Console
// proxy. They are reached only from the deployment host over Admin API loopback.
app.use('/admin-api/api/bootstrap', (_req, response) => {
  response.status(404).end();
});

app.use('/admin-api', async (request, response, next) => {
  // Deployment status is intentionally public; every other control-center
  // operation requires a current token for a global owner role.
  if (request.path === '/api/status/public') {
    next();
    return;
  }

  const authorization = await authorizeOwnerConsoleAdminRequest({
    authorization: request.get('authorization'),
    jwtSecret: ownerConsoleJwtSecret,
    gatewayUrl,
  });
  if (!authorization.authorized) {
    response.status(authorization.status).end();
    return;
  }
  next();
});

app.use(
  '/admin-api',
  createProxyMiddleware({
    target: adminApiUrl,
    changeOrigin: true,
  })
);

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  })
);

app.use('/**', (req, res, next) => {
  angularApp
    .handle(req, {
      url: getRequestUrl(req),
    })
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next()
    )
    .catch(next);
});

if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
