import { TestBed } from '@angular/core/testing';
import { MarketingGeneratorService } from './marketing-generator.service';
import { GenerationRequest } from '../types';

describe('MarketingGeneratorService', () => {
  let service: MarketingGeneratorService;

  const baseRequest: GenerationRequest = {
    offeringKind: 'preset-app',
    selectedOfferingId: 'fin-commander',
    customApp: {
      name: '',
      category: '',
      summary: '',
      features: '',
      differentiators: '',
      primaryGoal: '',
    },
    audienceId: 'finance-teams',
    campaignIntent: 'launch',
    channel: 'web',
    tone: 'editorial',
    includeAiPolish: false,
    deliverables: [
      { type: 'flyer', formatId: 'flyer-letter', quantity: 1 },
      { type: 'brochure', formatId: 'brochure-trifold', quantity: 1 },
      { type: 'business-card', formatId: 'business-card-standard', quantity: 1 },
      { type: 'web-ad', formatId: 'web-ad-square', quantity: 1 },
    ],
    brand: {
      businessName: 'Fin Commander',
      tagline: 'Finance command center',
      primaryColor: '#0f172a',
      secondaryColor: '#1d4ed8',
      accentColor: '#22c55e',
      visualStyle: 'Confident product-marketing',
      logoUrl: '',
    },
    visualDirection: 'Confident grid layouts with data-led imagery.',
    generateImages: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MarketingGeneratorService],
    });

    service = TestBed.inject(MarketingGeneratorService);
  });

  it('returns at least five distinct campaign concepts for a preset offering', async () => {
    const concepts = await service.generateConcepts(baseRequest);

    expect(concepts.length).toBeGreaterThanOrEqual(5);
    expect(new Set(concepts.map((concept) => concept.angle)).size).toBe(
      concepts.length
    );
    expect(concepts.every((concept) => concept.headline.length > 10)).toBe(
      true
    );
    expect(concepts.every((concept) => concept.materialOutputs.length >= 3)).toBe(
      true
    );
    expect(concepts.every((concept) => concept.channelOutputs.length >= 1)).toBe(
      true
    );
  });

  it('falls back to deterministic concepts when ai polish is unavailable', async () => {
    const concepts = await service.generateConcepts({
      ...baseRequest,
      includeAiPolish: true,
    });

    expect(concepts.length).toBeGreaterThanOrEqual(5);
    expect(concepts.every((concept) => concept.generationMode)).toBeTruthy();
    expect(concepts.some((concept) => concept.generationMode === 'template')).toBe(
      true
    );
  });

  it('uses a custom app brief when the user is marketing a custom product', async () => {
    const concepts = await service.generateConcepts({
      ...baseRequest,
      offeringKind: 'custom-app',
      selectedOfferingId: null,
      customApp: {
        name: 'Atlas Room',
        category: 'Research workspace',
        summary: 'A workspace for collecting signals and planning team investigations.',
        features: 'Shared boards, signal capture, tagged notes',
        differentiators: 'Faster synthesis, lightweight collaboration, durable context',
        primaryGoal: 'Earn product demo requests',
      },
    });

    expect(concepts[0].headline).toContain('Atlas Room');
    expect(concepts[0].subheadline).toContain('Research workspace');
  });

  it('marks one asset as primary for the selected channel and includes companion assets', async () => {
    const concepts = await service.generateConcepts({
      ...baseRequest,
      channel: 'email',
      campaignIntent: 'conversion',
    });

    expect(concepts[0].materialOutputs[0].type).toBe('flyer');
    expect(concepts[0].materialOutputs[0].isPrimary).toBe(true);
    expect(
      concepts[0].materialOutputs.some((asset) => asset.type === 'brochure')
    ).toBe(true);
    expect(
      concepts[0].materialOutputs.some((asset) => asset.type === 'web-ad')
    ).toBe(true);
  });

  it('builds typed material assets with format-specific surface counts', async () => {
    const concepts = await service.generateConcepts(baseRequest);
    const assetsByType = new Map(
      concepts[0].materialOutputs.map((asset) => [asset.type, asset])
    );

    expect(assetsByType.get('flyer')?.surfaces.map((surface) => surface.type)).toEqual([
      'front',
    ]);
    expect(assetsByType.get('brochure')?.surfaces.map((surface) => surface.type)).toEqual([
      'front',
      'inside-left',
      'inside-right',
      'back',
    ]);
    expect(assetsByType.get('business-card')?.surfaces.map((surface) => surface.type)).toEqual([
      'front',
      'back',
    ]);
    expect(assetsByType.get('web-ad')?.surfaces.map((surface) => surface.type)).toEqual([
      'single',
    ]);
  });

  it('produces channel-native web outputs when the request channel is web', async () => {
    const concepts = await service.generateConcepts({
      ...baseRequest,
      channel: 'web',
    });

    expect(
      concepts[0].channelOutputs.map((output) => output.type)
    ).toContain('landing-page');
    expect(concepts[0].channelOutputs[0].blocks.length).toBeGreaterThan(1);
  });

  it('produces channel-native email outputs when the request channel is email', async () => {
    const concepts = await service.generateConcepts({
      ...baseRequest,
      channel: 'email',
    });

    expect(
      concepts[0].channelOutputs.map((output) => output.type)
    ).toContain('email-sequence');
    expect(
      concepts[0].channelOutputs.find((output) => output.type === 'email-sequence')
        ?.blocks.length
    ).toBeGreaterThan(1);
  });

  it('produces channel-native social outputs when the request channel is social', async () => {
    const concepts = await service.generateConcepts({
      ...baseRequest,
      channel: 'social',
    });

    expect(
      concepts[0].channelOutputs.map((output) => output.type)
    ).toContain('social-campaign');
    expect(
      concepts[0].channelOutputs.find((output) => output.type === 'social-campaign')
        ?.blocks.length
    ).toBeGreaterThan(1);
  });
});
