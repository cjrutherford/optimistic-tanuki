import { of, throwError } from 'rxjs';
import { MarketingEnrichmentApiService } from './marketing-enrichment-api.service';
import { CampaignConcept, GenerationRequest } from '../types';

describe('MarketingEnrichmentApiService', () => {
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
      tagline: '',
      primaryColor: '#d97706',
      secondaryColor: '#0f172a',
      accentColor: '#2563eb',
      visualStyle: '',
      logoUrl: '',
    },
    visualDirection: '',
    generateImages: true,
  };

  const concepts: CampaignConcept[] = [
    {
      id: 'c1',
      angle: 'Operator clarity',
      generationMode: 'template',
      headline: 'Base headline',
      subheadline: 'Base subheadline',
      cta: 'Explore',
      channelLabel: 'Web',
      audienceLabel: 'Creators',
      sectionType: 'Narrative',
      sections: [{ title: 'Positioning', body: 'Base' }],
      channelOutputs: [
        {
          id: 'web-output',
          type: 'landing-page',
          label: 'Landing page draft',
          summary: 'Base summary',
          isPrimary: true,
          blocks: [
            {
              id: 'web-output-hero',
              role: 'hero',
              label: 'Hero headline',
              value: 'Base headline',
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
          surfaces: [],
          downloadFileName: 'video-client-flyer',
          isPrimary: true,
        },
      ],
    },
  ];

  it('returns enriched concepts from the endpoint', async () => {
    const httpClient = {
      post: jest.fn().mockReturnValue(of({ concepts: [{ ...concepts[0], headline: 'Enriched' }] })),
    } as any;

    const service = new MarketingEnrichmentApiService(httpClient);
    const result = await service.enrichConcepts(request, concepts);

    expect(httpClient.post).toHaveBeenCalledWith('/api/marketing-generator/enrich', {
      request,
      concepts,
    });
    expect(result[0].headline).toBe('Enriched');
  });

  it('falls back to original concepts when the endpoint fails', async () => {
    const httpClient = {
      post: jest.fn().mockReturnValue(throwError(() => new Error('boom'))),
    } as any;

    const service = new MarketingEnrichmentApiService(httpClient);
    const result = await service.enrichConcepts(request, concepts);

    expect(result).toEqual(concepts);
  });
});
