import { createOllamaSummarizer } from '../src/summarizer.js';
import { DEFAULT_OLLAMA_BASE_URL } from '../src/gateway.js';

test('uses the canonical Shangri-La Ollama endpoint by default', () => {
  expect(DEFAULT_OLLAMA_BASE_URL).toBe(
    'http://shangrila.tail5a4a0.ts.net:11434/v1'
  );
});

test('records deterministic generation settings and sends an OpenAI-compatible request', async () => {
  let request: Record<string, unknown> | undefined;
  const summarizer = createOllamaSummarizer({
    baseUrl: 'http://test.local/v1',
    primary: 'candidate',
    fallback: 'candidate',
    generation: { temperature: 0, seed: 17, numCtx: 8192 },
    fetchImpl: async (_url, init) => {
      request = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  headline: 'Road update',
                  summary: 'Road work begins.',
                  whyItMatters: 'Residents can plan.',
                  citations: [{ sourceKey: 'town-news', civicItemId: 17 }],
                }),
              },
            },
          ],
        }),
        { status: 200 }
      );
    },
  });
  const result = await summarizer.summarizeCluster({
    kind: 'news',
    topic: 'roads',
    items: [
      {
        sourceKey: 'town-news',
        civicItemId: 17,
        title: 'Road work',
        body: 'Road work begins.',
      },
    ],
  });
  expect(result.analysis.provenance.generationSettings?.temperature).toBe(0);
  expect(result.analysis.provenance.generationSettings?.seed).toBe(17);
  expect(result.analysis.provenance.generationSettings?.numCtx).toBe(8192);
  expect(request?.['temperature']).toStrictEqual(0);
  expect(request?.['seed']).toStrictEqual(17);
  expect(request?.['num_ctx']).toBe(undefined);
  expect(request?.['options']).toBe(undefined);
});

test('allows generation defaults to be overridden by environment settings', () => {
  const previous = {
    temperature: process.env['GATEWAY_TEMPERATURE'],
    seed: process.env['GATEWAY_SEED'],
    numCtx: process.env['GATEWAY_NUM_CTX'],
  };
  try {
    process.env['GATEWAY_TEMPERATURE'] = '0.15';
    process.env['GATEWAY_SEED'] = '23';
    process.env['GATEWAY_NUM_CTX'] = '4096';
    const summarizer = createOllamaSummarizer({
      primary: 'candidate',
      fallback: 'candidate',
    });
    expect(summarizer.generation).toStrictEqual({
      temperature: 0.15,
      seed: 23,
      numCtx: 4096,
    });
  } finally {
    for (const [name, value] of Object.entries({
      GATEWAY_TEMPERATURE: previous.temperature,
      GATEWAY_SEED: previous.seed,
      GATEWAY_NUM_CTX: previous.numCtx,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
