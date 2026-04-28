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
                  status: 'idle',
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
                  status: 'idle',
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  it('returns deterministic concepts when the model endpoint is unavailable', async () => {
    const server = new MarketingEnrichmentServer({
      model: 'gemma3',
      timeoutMs: 1000,
      fetchImpl: jest.fn().mockRejectedValue(new Error('offline')),
    });

    const result = await server.enrich(request, concepts);

    expect(result).toEqual(concepts);
  });

  it('merges enriched material copy and prompts into matching assets and surfaces', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
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
    });

    const server = new MarketingEnrichmentServer({
      model: 'gemma3',
      timeoutMs: 1000,
      fetchImpl,
      baseUrl: 'http://ollama:11434',
    });

    const result = await server.enrich(request, concepts);

    expect(fetchImpl).toHaveBeenCalled();
    expect(result[0].generationMode).toBe('hybrid');
    expect(result[0].headline).toBe('A better enriched headline');
    expect(result[0].channelOutputs[0].label).toBe('Launch landing draft');
    expect(result[0].channelOutputs[0].summary).toBe('Enriched landing summary');
    expect(result[0].channelOutputs[0].blocks[0].value).toBe(
      'Landing hero enriched'
    );
    expect(result[0].materialOutputs[0].label).toBe('Launch Flyer');
    expect(result[0].materialOutputs[0].layoutVariant).toBe('offer-grid');
    expect(result[0].materialOutputs[0].surfaces[0].textBlocks[0].id).toBe(
      'flyer-0-surface-0-headline'
    );
    expect(result[0].materialOutputs[0].surfaces[0].textBlocks[0].value).toBe(
      'Hero headline enriched'
    );
    expect(result[0].materialOutputs[0].surfaces[0].imageSlots[0].prompt).toBe(
      'Refined cinematic prompt'
    );
    expect(result[0].materialOutputs[1]).toEqual(concepts[0].materialOutputs[1]);
  });
});
