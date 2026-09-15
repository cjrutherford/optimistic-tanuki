import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configureBrowserServerRoutes } from './browser-server-routing';
import { createGatewayProxy } from './server-proxy';
import { applyPublicAppSecurityHeaders } from './server-security';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
const browserIndexPath = resolve(browserDistFolder, 'index.csr.html');
const serverStartedAt = Date.now();
const app = express();
const angularApp = new AngularNodeAppEngine();
const gatewayUrl = process.env['GATEWAY_URL'] || 'http://gateway:3000';

app.use(applyPublicAppSecurityHeaders);

// Proxy only the browser API surfaces this app uses. The proxy preserves the
// original /api/... path because Express strips a mounted prefix before the
// middleware sees it.
app.use(
  ['/api-docs', '/api/learning', '/api/authentication'],
  createGatewayProxy(gatewayUrl)
);

configureBrowserServerRoutes(app, {
  browserDistFolder,
  browserIndexPath,
  serverStartedAt,
  render: (req, res, next) => {
    angularApp
      .handle(req)
      .then((response) =>
        response ? writeResponseToNodeResponse(response, res) : next()
      )
      .catch(next);
  },
});

if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
