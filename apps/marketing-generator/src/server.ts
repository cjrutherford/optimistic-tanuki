import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import { createProxyMiddleware } from 'http-proxy-middleware';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MarketingEnrichmentServer } from './app/services/marketing-enrichment.server';
import { CampaignConcept, GenerationRequest } from './app/types';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
const app = express();
const angularApp = new AngularNodeAppEngine();
const gatewayUrl = process.env['GATEWAY_URL'] || 'http://gateway:3000';
const enrichmentServer = new MarketingEnrichmentServer();

const applyPublicAppSecurityHeaders: express.RequestHandler = (
  req,
  res,
  next
) => {
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
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
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

  next();
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

app.use(express.json({ limit: '1mb' }));

app.post('/api/marketing-generator/enrich', async (req, res) => {
  const body = req.body as {
    request?: GenerationRequest;
    concepts?: CampaignConcept[];
  };

  if (!body?.request || !Array.isArray(body.concepts)) {
    res.status(400).json({
      error: 'Invalid enrichment payload.',
    });
    return;
  }

  const concepts = await enrichmentServer.enrich(body.request, body.concepts);
  res.json({
    concepts,
    enrichmentApplied: concepts.some(
      (concept) => concept.generationMode === 'hybrid'
    ),
  });
});

app.use(
  '/api',
  createProxyMiddleware({
    target: `${gatewayUrl}/api`,
    ws: true,
    changeOrigin: true,
  })
);

app.use('/**', (req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next()
    )
    .catch(next);
});

if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4213;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
