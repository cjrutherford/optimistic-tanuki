import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine, isMainModule } from '@angular/ssr/node';
import { createProxyMiddleware } from 'http-proxy-middleware';
import express from 'express';
import cookieParser from 'cookie-parser';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bootstrap from './main.server';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
const indexHtml = join(serverDistFolder, 'index.server.html');

const app = express();
const commonEngine = new CommonEngine();

const gatewayUrl = process.env['GATEWAY_URL'] || 'http://gateway:3000';
const gatewayWsUrl = process.env['GATEWAY_WS_URL'] || 'http://gateway:3300';

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

const PROTECTED_ROUTES = [
  '/account',
  '/seller-dashboard',
  '/messages',
  '/messages/new',
];

const MEMBER_ROUTES = [
  '/city/:slug/classifieds/new',
  '/c/:communitySlug/classifieds/new',
];

function isAuthenticated(req: express.Request): boolean {
  const token =
    req.cookies['ot-local-hub-authToken'] ||
    req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return false;
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }
    const payload = JSON.parse(atob(parts[1]));
    const expiresAt = payload.exp * 1000;
    return expiresAt > Date.now();
  } catch {
    return false;
  }
}

function isProtectedRoute(path: string): boolean {
  return PROTECTED_ROUTES.some((route) => {
    if (route.includes(':')) {
      const pattern = route.replace(/:[^/]+/g, '[^/]+');
      return new RegExp(`^${pattern}$`).test(path);
    }
    return path.startsWith(route);
  });
}

function requiresMemberRoute(path: string): boolean {
  return MEMBER_ROUTES.some((route) => {
    const pattern = route.replace(/:[^/]+/g, '[^/]+');
    return new RegExp(`^${pattern}$`).test(path);
  });
}

function getReturnUrl(req: express.Request): string {
  return (req.query['returnUrl'] as string) || req.originalUrl;
}

app.use((req, res, next) => {
  const path = req.path;

  if (isProtectedRoute(path) || requiresMemberRoute(path)) {
    if (!isAuthenticated(req)) {
      const returnUrl = getReturnUrl(req);
      const loginUrl = `/login${
        returnUrl && returnUrl !== '/'
          ? `?returnUrl=${encodeURIComponent(returnUrl)}`
          : ''
      }`;
      return res.redirect(loginUrl);
    }
  }

  next();
});

app.get(
  '**',
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: 'index.html',
  })
);

app.get('**', (req, res, next) => {
  const { protocol, originalUrl, baseUrl, headers } = req;

  commonEngine
    .render({
      bootstrap,
      documentFilePath: indexHtml,
      url: `${protocol}://${headers.host}${originalUrl}`,
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
