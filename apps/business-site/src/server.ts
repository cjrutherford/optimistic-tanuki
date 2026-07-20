import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import express from 'express';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEvaluatorGuideEnabled } from './server-evaluator-guide';
import { cspNonceStorage } from './csp-nonce';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
const evaluatorGuidePath = resolve(
  process.env['EVALUATOR_GUIDE_PATH'] ||
    '/app/docs/guides/business-site-evaluator-guide.html'
);
const app = express();
const angularApp = new AngularNodeAppEngine();
const gatewayUrl = process.env['GATEWAY_URL'] || 'http://gateway:3000';
const gatewayOrigin = new URL(gatewayUrl).origin;
const gatewayHost = new URL(gatewayUrl).host;

// Matches the literal placeholder attribute value on <app-root> in
// index.html. It gets swapped for the real per-request nonce once the
// Angular SSR response is fully rendered (see the '/**' handler below) —
// after Angular's own critical-CSS inliner has already copied the
// placeholder into any inline <style> tags it generates, so a single
// substitution fixes every occurrence.
const CSP_NONCE_PLACEHOLDER = '__CSP_NONCE_PLACEHOLDER__';
const CSP_NONCE_LOCAL_KEY = 'cspNonce';

const applyPublicAppSecurityHeaders: express.RequestHandler = (
  req,
  res,
  next
) => {
  // A fresh, cryptographically random nonce per request/response — never a
  // fixed or build-time value. It is threaded through AsyncLocalStorage so
  // Angular's CSP_NONCE token (app.config.server.ts) resolves to the exact
  // same value used in the header below.
  const nonce = randomBytes(16).toString('base64');
  res.locals[CSP_NONCE_LOCAL_KEY] = nonce;

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), geolocation=(), microphone=(), payment=(), usb=()'
  );
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: https:",
      "font-src 'self' data: https:",
      `style-src 'self' 'nonce-${nonce}'`,
      "script-src 'self'",
      "connect-src 'self' http: https: ws: wss:",
      "object-src 'none'",
    ].join('; ')
  );

  const forwardedProto = req.get('x-forwarded-proto');
  if (req.secure || forwardedProto?.includes('https')) {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  cspNonceStorage.run(nonce, next);
};

app.disable('x-powered-by');
app.use(applyPublicAppSecurityHeaders);
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  })
);

if (isEvaluatorGuideEnabled()) {
  app.get(['/eval', '/eval/'], async (req, res, next) => {
    try {
      const guide = await readFile(evaluatorGuidePath, 'utf8');
      res.type('html').send(guide);
    } catch (error) {
      next(error);
    }
  });
}

app.use(express.json({ limit: '1mb' }));

app.use(
  '/api',
  createProxyMiddleware({
    target: `${gatewayUrl}/api`,
    ws: true,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq, req) => {
        fixRequestBody(proxyReq, req);
        proxyReq.setHeader('host', gatewayHost);
        if (req.headers.origin) {
          proxyReq.setHeader('origin', gatewayOrigin);
        }
      },
    },
  })
);

app.use('/**', (req, res, next) => {
  angularApp
    .handle(req)
    .then(async (response) => {
      if (!response) {
        next();
        return;
      }

      const nonce: string | undefined = res.locals[CSP_NONCE_LOCAL_KEY];
      const contentType = response.headers.get('content-type') ?? '';
      if (!nonce || !contentType.includes('text/html')) {
        await writeResponseToNodeResponse(response, res);
        return;
      }

      // Swap the build-time placeholder for the real, per-request nonce in
      // the rendered HTML (the <app-root ngCspNonce="..."> attribute, and
      // any inline critical-CSS <style nonce="..."> tag Angular copied it
      // into) so it matches the nonce already sent in the CSP header above.
      const html = await response.text();
      const patchedHtml = html.split(CSP_NONCE_PLACEHOLDER).join(nonce);
      const patchedHeaders = new Headers(response.headers);
      patchedHeaders.set(
        'content-length',
        Buffer.byteLength(patchedHtml).toString()
      );

      await writeResponseToNodeResponse(
        new Response(patchedHtml, {
          status: response.status,
          statusText: response.statusText,
          headers: patchedHeaders,
        }),
        res
      );
    })
    .catch(next);
});

if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4214;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
