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
import {
  LlmConceptResult,
  MarketingEnrichmentServer,
} from './app/services/marketing-enrichment.server';
import { CampaignConcept, GenerationRequest } from './app/types';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
const app = express();
const angularApp = new AngularNodeAppEngine();
const gatewayUrl = process.env['GATEWAY_URL'] || 'http://gateway:3000';
const enrichmentServer = new MarketingEnrichmentServer();

type LlmEndpoint = 'enrich' | 'generate';

interface EndpointUsageCounter {
  calls: number;
  applied: number;
  failed: number;
  promptTokens: number;
  completionTokens: number;
  lastModel: string | null;
}

// Per-process observability only. These counters reset on restart and are not
// a billing source of truth; they surface token usage for operators/tests.
const usageCounters: Record<LlmEndpoint, EndpointUsageCounter> = {
  enrich: {
    calls: 0,
    applied: 0,
    failed: 0,
    promptTokens: 0,
    completionTokens: 0,
    lastModel: null,
  },
  generate: {
    calls: 0,
    applied: 0,
    failed: 0,
    promptTokens: 0,
    completionTokens: 0,
    lastModel: null,
  },
};

const recordUsage = (endpoint: LlmEndpoint, result: LlmConceptResult): void => {
  const counter = usageCounters[endpoint];
  counter.calls += 1;
  if (result.applied) {
    counter.applied += 1;
  } else {
    counter.failed += 1;
  }
  if (result.usage) {
    counter.promptTokens += result.usage.promptTokens;
    counter.completionTokens += result.usage.completionTokens;
    counter.lastModel = result.usage.model;
  }

  console.info(
    JSON.stringify({
      event: 'marketing-generator.llm-usage',
      endpoint,
      model: result.usage?.model ?? null,
      promptTokens: result.usage?.promptTokens ?? 0,
      completionTokens: result.usage?.completionTokens ?? 0,
      totalDurationMs: result.usage?.totalDurationMs ?? 0,
      applied: result.applied,
      failureReason: result.failureReason ?? null,
    })
  );
};

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

  const result = await enrichmentServer.enrich(body.request, body.concepts);
  recordUsage('enrich', result);
  res.json({
    concepts: result.concepts,
    enrichmentApplied: result.applied,
    usage: result.usage,
  });
});

app.post('/api/marketing-generator/generate', async (req, res) => {
  const body = req.body as {
    request?: GenerationRequest;
    concepts?: CampaignConcept[];
  };

  if (!body?.request || !Array.isArray(body.concepts)) {
    res.status(400).json({
      error: 'Invalid generation payload.',
    });
    return;
  }

  const result = await enrichmentServer.generate(body.request, body.concepts);
  recordUsage('generate', result);
  res.json({
    concepts: result.concepts,
    generationApplied: result.applied,
    usage: result.usage,
  });
});

app.get('/api/marketing-generator/usage', (_req, res) => {
  res.json(usageCounters);
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
