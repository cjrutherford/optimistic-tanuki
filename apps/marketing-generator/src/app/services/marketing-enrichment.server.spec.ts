import { MarketingEnrichmentServer } from './marketing-enrichment.server';
import { CampaignConcept, GenerationRequest } from '../types';

describe('MarketingEnrichmentServer', () => {
  const request: GenerationRequest = {
    offeringKind: 'preset-app',
    selectedOfferingId: 'video-client',
    customApp: {
      name: '',
      category: '',
      summary: '',
      features: '',
      differentiators: '',
      primaryGoal: '',
    },
    audienceId: 'creators',
    campaignIntent: 'awareness',
    channel: 'web',
    secondaryChannels: [],
    tone: 'editorial',
    includeAiPolish: true,
    deliverables: [{ type: 'flyer', formatId: 'flyer-letter', quantity: 1 }],
    brand: {
      businessName: 'Video Client',
      tagline: 'Ship client-ready edits faster',
      primaryColor: '#f59e0b',
      secondaryColor: '#1f2937',
      accentColor: '#34d399',
      visualStyle: 'Editorial launch visuals',
      logoUrl: '',
    },
    visualDirection: 'Warm product storytelling',
    generateImages: true,
  };

  const concepts: CampaignConcept[] = [
    {
      id: 'video-client-operator-0',
      angle: 'Operator clarity',
      generationMode: 'template',
      headline: 'Video Client for creators who need a sharper first impression',
      subheadline: 'Streaming platform built to move faster.',
      cta: 'Explore the offer',
      channelLabel: 'Web landing concept',
      audienceLabel: 'Creators',
      sectionType: 'Narrative landing',
      sections: [
        { title: 'Positioning', body: 'Base positioning copy.' },
        { title: 'Why it lands', body: 'Base rationale copy.' },
        { title: 'Audience trigger', body: 'Base trigger copy.' },
      ],
      channelOutputs: [
        {
          id: 'landing-page-operator',
          type: 'landing-page',
          label: 'Landing page draft',
          summary: 'Base landing summary',
          isPrimary: true,
          blocks: [
            {
              id: 'landing-page-operator-hero',
              role: 'hero',
              label: 'Hero headline',
              value: 'Base web headline',
            },
            {
              id: 'landing-page-operator-supporting',
              role: 'supporting',
              label: 'Hero support',
              value: 'Base web support',
            },
          ],
        },
      ],
      materialOutputs: [
        {
          id: 'flyer-0',
          type: 'flyer',
          formatId: 'flyer-letter',
          label: 'Letter Flyer',
          canvas: { width: 1275, height: 1650, unit: 'px', dpi: 150 },
          layoutVariant: 'hero-focus',
          downloadFileName: 'video-client-flyer-letter-operator-clarity',
          isPrimary: true,
          surfaces: [
            {
              id: 'flyer-0-surface-0',
              label: 'Front',
              type: 'front',
              textBlocks: [
                {
                  id: 'flyer-0-surface-0-headline',
                  role: 'headline',
                  label: 'Flyer Front headline',
                  value: 'Base headline',
                },
                {
                  id: 'flyer-0-surface-0-body',
                  role: 'body',
                  label: 'Flyer Front body',
                  value: 'Base body',
                },
              ],
              imageSlots: [
                {
                  id: 'flyer-0-surface-0-image',
                  prompt: 'Base prompt',
                  alt: 'Base alt',
                  imageUrl: null,
                  status: 'prompt-ready',
                  imageBase64: null,
                  errorMessage: null,
                },
              ],
            },
          ],
        },
        {
          id: 'web-ad-1',
          type: 'web-ad',
          formatId: 'web-ad-square',
          label: 'Square Ad',
          canvas: { width: 1080, height: 1080, unit: 'px' },
          layoutVariant: 'bold-cta',
          downloadFileName: 'video-client-web-ad-square-operator-clarity',
          isPrimary: false,
          surfaces: [
            {
              id: 'web-ad-1-surface-0',
              label: 'Single panel',
              type: 'single',
              textBlocks: [
                {
                  id: 'web-ad-1-surface-0-headline',
                  role: 'headline',
                  label: 'Web ad Single panel headline',
                  value: 'Ad headline',
                },
              ],
              imageSlots: [
                {
                  id: 'web-ad-1-surface-0-image',
                  prompt: 'Ad prompt',
                  alt: 'Ad alt',
                  imageUrl: null,
                  status: 'prompt-ready',
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  const enrichmentPayloadResponse = {
    ok: true,
    json: async () => ({
      model: 'gemma3',
      prompt_eval_count: 128,
      eval_count: 64,
      total_duration: 2_000_000_000,
      message: {
        content: JSON.stringify({
          concepts: [
            {
              id: 'video-client-operator-0',
              headline: 'A better enriched headline',
              subheadline: 'An enriched subheadline',
              channelOutputs: [
                {
                  id: 'landing-page-operator',
                  label: 'Launch landing draft',
                  summary: 'Enriched landing summary',
                  blocks: [
                    {
                      id: 'landing-page-operator-hero',
                      value: 'Landing hero enriched',
                    },
                  ],
                },
              ],
              materialOutputs: [
                {
                  id: 'flyer-0',
                  label: 'Launch Flyer',
                  layoutVariant: 'offer-grid',
                  surfaces: [
                    {
                      id: 'flyer-0-surface-0',
                      textBlocks: [
                        {
                          id: 'flyer-0-surface-0-headline',
                          value: 'Hero headline enriched',
                        },
                        {
                          id: 'flyer-0-surface-0-body',
                          value: 'Hero body enriched',
                        },
                      ],
                      imageSlots: [
                        {
                          id: 'flyer-0-surface-0-image',
                          prompt: 'Refined cinematic prompt',
                          alt: 'Refined alt copy',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        }),
      },
    }),
  };

  it('returns deterministic concepts and no usage when the model endpoint is unavailable', async () => {
    const server = new MarketingEnrichmentServer({
      model: 'gemma3',
      timeoutMs: 1000,
      fetchImpl: jest.fn().mockRejectedValue(new Error('offline')),
    });

    const result = await server.enrich(request, concepts);

    expect(result.concepts).toEqual(concepts);
    expect(result.applied).toBe(false);
    expect(result.usage).toBeNull();
    expect(result.failureReason).toContain('offline');
  });

  it('merges enriched material copy and prompts into matching assets and reports usage', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(enrichmentPayloadResponse);

    const server = new MarketingEnrichmentServer({
      model: 'gemma3',
      timeoutMs: 1000,
      fetchImpl,
      baseUrl: 'http://ollama:11434',
    });

    const result = await server.enrich(request, concepts);

    expect(fetchImpl).toHaveBeenCalled();
    expect(result.applied).toBe(true);
    expect(result.usage).toEqual({
      model: 'gemma3',
      promptTokens: 128,
      completionTokens: 64,
      totalDurationMs: 2000,
    });
    expect(result.concepts[0].generationMode).toBe('hybrid');
    expect(result.concepts[0].headline).toBe('A better enriched headline');
    expect(result.concepts[0].channelOutputs[0].label).toBe(
      'Launch landing draft'
    );
    expect(result.concepts[0].channelOutputs[0].summary).toBe(
      'Enriched landing summary'
    );
    expect(result.concepts[0].channelOutputs[0].blocks[0].value).toBe(
      'Landing hero enriched'
    );
    expect(result.concepts[0].materialOutputs[0].label).toBe('Launch Flyer');
    expect(result.concepts[0].materialOutputs[0].layoutVariant).toBe(
      'offer-grid'
    );
    expect(
      result.concepts[0].materialOutputs[0].surfaces[0].textBlocks[0].value
    ).toBe('Hero headline enriched');
    expect(
      result.concepts[0].materialOutputs[0].surfaces[0].imageSlots[0].prompt
    ).toBe('Refined cinematic prompt');
    expect(result.concepts[0].materialOutputs[1]).toEqual(
      concepts[0].materialOutputs[1]
    );
  });

  it('falls back with a reason and usage when the response is not valid JSON', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'gemma3',
        prompt_eval_count: 10,
        eval_count: 0,
        total_duration: 1_000_000,
        message: { content: 'Sorry, I cannot help with that.' },
      }),
    });

    const server = new MarketingEnrichmentServer({
      model: 'gemma3',
      timeoutMs: 1000,
      fetchImpl,
    });

    const result = await server.enrich(request, concepts);

    expect(result.applied).toBe(false);
    expect(result.concepts).toEqual(concepts);
    expect(result.failureReason).toBeTruthy();
    expect(result.usage).toEqual({
      model: 'gemma3',
      promptTokens: 10,
      completionTokens: 0,
      totalDurationMs: 1,
    });
  });

  it('falls back when the parsed payload violates the schema', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'gemma3',
        message: {
          content: JSON.stringify({ concepts: 'not-an-array' }),
        },
      }),
    });

    const server = new MarketingEnrichmentServer({
      model: 'gemma3',
      timeoutMs: 1000,
      fetchImpl,
    });

    const result = await server.enrich(request, concepts);

    expect(result.applied).toBe(false);
    expect(result.concepts).toEqual(concepts);
    expect(result.failureReason).toContain('schema');
  });

  it('reports applied: false when a schema-valid payload matches no scaffold ids', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'gemma3',
        prompt_eval_count: 5,
        eval_count: 5,
        total_duration: 1_000_000,
        message: {
          content: JSON.stringify({
            concepts: [{ id: 'unknown-concept', headline: 'Orphan copy' }],
          }),
        },
      }),
    });

    const server = new MarketingEnrichmentServer({
      model: 'gemma3',
      timeoutMs: 1000,
      fetchImpl,
    });

    const result = await server.generate(request, concepts);

    expect(result.applied).toBe(false);
    expect(result.concepts).toEqual(concepts);
    expect(result.failureReason).toContain('scaffold ids');
  });

  it('authors campaign copy into the scaffold with generationMode "llm"', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'gemma3',
        prompt_eval_count: 200,
        eval_count: 150,
        total_duration: 3_000_000_000,
        message: {
          content: JSON.stringify({
            concepts: [
              {
                id: 'video-client-operator-0',
                headline: 'Authored launch headline',
                subheadline: 'Authored subheadline',
                sections: [
                  { title: 'Positioning', body: 'Authored positioning copy.' },
                  { title: 'Why it lands', body: 'Authored rationale copy.' },
                  { title: 'Audience trigger', body: 'Authored trigger copy.' },
                ],
              },
            ],
          }),
        },
      }),
    });

    const server = new MarketingEnrichmentServer({
      model: 'gemma3',
      timeoutMs: 1000,
      fetchImpl,
    });

    const result = await server.generate(request, concepts);

    expect(result.applied).toBe(true);
    expect(result.concepts[0].generationMode).toBe('llm');
    expect(result.concepts[0].headline).toBe('Authored launch headline');
    expect(result.concepts[0].sections[0].body).toBe(
      'Authored positioning copy.'
    );
    expect(result.usage?.completionTokens).toBe(150);
  });

  it('falls back to the scaffold when generate() cannot reach the model', async () => {
    const server = new MarketingEnrichmentServer({
      model: 'gemma3',
      timeoutMs: 1000,
      fetchImpl: jest.fn().mockRejectedValue(new Error('connection refused')),
    });

    const result = await server.generate(request, concepts);

    expect(result.applied).toBe(false);
    expect(result.concepts).toEqual(concepts);
    expect(result.usage).toBeNull();
    expect(result.failureReason).toContain('connection refused');
  });

  it('sends the configured temperature in the request body', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(enrichmentPayloadResponse);

    const server = new MarketingEnrichmentServer({
      model: 'gemma3',
      timeoutMs: 1000,
      temperature: 0.42,
      fetchImpl,
    });

    await server.enrich(request, concepts);

    const [, init] = fetchImpl.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.options.temperature).toBe(0.42);
  });

  it('sanitizes and caps free-text brief fields before embedding them', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(enrichmentPayloadResponse);

    const server = new MarketingEnrichmentServer({
      model: 'gemma3',
      timeoutMs: 1000,
      fetchImpl,
    });

    const noisyRequest: GenerationRequest = {
      ...request,
      visualDirection: `line1\nline2\ttabbed   spaced\u0000null`,
      brand: { ...request.brand, tagline: 'x'.repeat(900) },
    };

    await server.enrich(noisyRequest, concepts);

    const [, init] = fetchImpl.mock.calls[0];
    const body = JSON.parse(init.body as string);
    const embedded = JSON.parse(body.messages[1].content) as {
      request: GenerationRequest;
    };

    expect(embedded.request.visualDirection).toBe(
      'line1 line2 tabbed spaced null'
    );
    expect(embedded.request.brand.tagline.length).toBe(500);
    // Caller object must not be mutated.
    expect(noisyRequest.brand.tagline.length).toBe(900);
  });
});
