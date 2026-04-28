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
  res.json({ concepts });
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
