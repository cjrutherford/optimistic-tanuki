import { MarketingGeneratorService } from './marketing-generator.service';
import { GenerationRequest } from '../types';

describe('MarketingGeneratorService', () => {
  const service = new MarketingGeneratorService();

  const request: GenerationRequest = {
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
    campaignIntent: 'conversion',
    channel: 'web',
    secondaryChannels: [],
    tone: 'direct',
    includeAiPolish: false,
    deliverables: [{ type: 'flyer', formatId: 'flyer-letter', quantity: 1 }],
    brand: {
      businessName: 'Fin Commander',
      tagline: '',
      primaryColor: '#f59e0b',
      secondaryColor: '#111827',
      accentColor: '#34d399',
      visualStyle: '',
      logoUrl: '',
    },
    visualDirection: '',
    generateImages: false,
  };

  it('includes offering objectives and proof points in generated concepts', async () => {
    const [concept] = await service.generateConcepts(request);

    expect(concept.objectives?.length).toBeGreaterThan(1);
    expect(concept.proofPoints?.length).toBeGreaterThan(1);
    expect(
      concept.sections.some(
        (section) => section.title === 'Objective alignment'
      )
    ).toBe(true);
  });

  it('aligns generated concept text to the selected offering positioning', async () => {
    const [concept] = await service.generateConcepts(request);

    expect(concept.positioning).toContain('guided');
    expect(concept.headline.toLowerCase()).toContain('fin commander');
    expect(
      concept.materialOutputs[0].surfaces[0].textBlocks.some((block) =>
        block.value.includes('ledgers')
      )
    ).toBe(true);
  });

  it('carries pricing and delivery posture for hosted service offerings', async () => {
    const [concept] = await service.generateConcepts({
      ...request,
      selectedOfferingId: 'billing-service',
      audienceId: 'technical-buyers',
    });

    expect(concept.deliveryModel).toBe('hybrid');
    expect(concept.pricingModel).toBe('metered');
    expect(concept.selfHostedNote).toContain('Docker');
    expect(
      concept.sections.some((section) => section.title === 'Delivery model')
    ).toBe(true);
  });

  it('assigns advertisement template metadata to generated material outputs', async () => {
    const [concept] = await service.generateConcepts(request);

    expect(concept.materialOutputs[0].templateFamily).toBe('print-flyer');
    expect(concept.materialOutputs[0].templateName).toBe('issue-led');
  });

  it('keeps generated material text blocks as plain text', async () => {
    const [concept] = await service.generateConcepts(request);
    const values = concept.materialOutputs.flatMap((asset) =>
      asset.surfaces.flatMap((surface) =>
        surface.textBlocks.map((block) => block.value)
      )
    );

    expect(values.length).toBeGreaterThan(0);
    expect(values.every((value) => !value.includes('<'))).toBe(true);
  });

  it('builds bundled outputs for the primary and selected secondary channels', async () => {
    const [concept] = await service.generateConcepts({
      ...request,
      channel: 'web',
      secondaryChannels: ['email', 'social'],
    });

    expect(concept.channelOutputs.map((output) => output.type)).toEqual([
      'landing-page',
      'email-sequence',
      'social-campaign',
    ]);
    expect(concept.channelOutputs[0]?.isPrimary).toBe(true);
    expect(
      concept.channelOutputs.slice(1).every((output) => !output.isPrimary)
    ).toBe(true);
  });

  it('marks image slots as prompt-ready or prompt-disabled instead of implying rendered images', async () => {
    const [withPrompts] = await service.generateConcepts({
      ...request,
      generateImages: true,
    });
    const [withoutPrompts] = await service.generateConcepts({
      ...request,
      generateImages: false,
    });

    expect(withPrompts.materialOutputs[0].surfaces[0].imageSlots[0]).toEqual(
      expect.objectContaining({
        status: 'prompt-ready',
        errorMessage: null,
      })
    );
    expect(withoutPrompts.materialOutputs[0].surfaces[0].imageSlots[0]).toEqual(
      expect.objectContaining({
        status: 'prompt-disabled',
        errorMessage: 'Image prompt preparation disabled.',
      })
    );
  });

  it('varies generated concept and material copy using offering ad archetypes', async () => {
    const [communityConcept] = await service.generateConcepts({
      ...request,
      selectedOfferingId: 'client-interface',
      audienceId: 'community-operators',
    });
    const [billingConcept] = await service.generateConcepts({
      ...request,
      selectedOfferingId: 'billing-service',
      audienceId: 'technical-buyers',
    });

    expect(
      communityConcept.sections.some((section) =>
        section.body.toLowerCase().includes('owned community network')
      )
    ).toBe(true);
    expect(
      billingConcept.sections.some((section) =>
        section.body.toLowerCase().includes('managed billing backend')
      )
    ).toBe(true);
    expect(
      communityConcept.materialOutputs[0].surfaces[0].textBlocks.some((block) =>
        block.value.toLowerCase().includes('owned community network')
      )
    ).toBe(true);
    expect(
      billingConcept.materialOutputs[0].surfaces[0].textBlocks.some((block) =>
        block.value.toLowerCase().includes('managed billing backend')
      )
    ).toBe(true);
  });

  it('can regenerate a single channel block without rebuilding the full concept set', async () => {
    const [concept] = await service.generateConcepts({
      ...request,
      channel: 'email',
    });
    const output = concept.channelOutputs[0];
    const block = output.blocks[0];

    const regenerated = await service.regenerateChannelBlock(
      request,
      concept,
      output,
      block
    );

    expect(regenerated).not.toBe(block.value);
    expect(regenerated.toLowerCase()).toContain('fin commander');
  });

  it('can regenerate a single material text block without introducing html markup', async () => {
    const [concept] = await service.generateConcepts(request);
    const asset = concept.materialOutputs[0];
    const surface = asset.surfaces[0];
    const block = surface.textBlocks[0];

    const regenerated = await service.regenerateMaterialTextBlock(
      request,
      concept,
      asset,
      surface,
      block
    );

    expect(regenerated).not.toBe(block.value);
    expect(regenerated.includes('<')).toBe(false);
    expect(regenerated.toLowerCase()).toContain('fin commander');
  });
});
