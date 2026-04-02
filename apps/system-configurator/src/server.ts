import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine, isMainModule } from '@angular/ssr/node';
import { createProxyMiddleware } from 'http-proxy-middleware';
import express from 'express';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bootstrap from './main.server';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
const indexHtml = join(serverDistFolder, 'index.server.html');

const app = express();
const commonEngine = new CommonEngine();

const gatewayUrl = process.env['GATEWAY_URL'] || 'http://gateway:3000';
const listenPort = process.env['PORT'] || '4000';
const serverRenderOrigin =
  process.env['SSR_ORIGIN'] || `http://127.0.0.1:${listenPort}`;

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
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

app.get(
  '**',
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: 'index.html',
  })
);

app.get('**', (req, res, next) => {
  const { originalUrl, baseUrl } = req;

  commonEngine
    .render({
      bootstrap,
      documentFilePath: indexHtml,
      url: `${serverRenderOrigin}${originalUrl}`,
      publicPath: browserDistFolder,
      providers: [{ provide: APP_BASE_HREF, useValue: baseUrl }],
    })
    .then((html) => res.send(html))
    .catch(next);
});

if (isMainModule(import.meta.url)) {
  app.listen(listenPort, () => {
    console.log(`Node Express server listening on http://localhost:${listenPort}`);
  });
}

export default app;
