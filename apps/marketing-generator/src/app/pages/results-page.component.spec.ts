import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ResultsPageComponent } from './results-page.component';
import { MarketingStateService } from '../services/marketing-state.service';
import { MarketingGeneratorService } from '../services/marketing-generator.service';
import { MarketingEnrichmentApiService } from '../services/marketing-enrichment-api.service';
import { MarketingInsightsService } from '../services/marketing-insights.service';
import { CampaignConcept, GenerationRequest } from '../types';

const buildInsightsStub = () => ({
  summary: signal({
    generationRuns: 1,
    conceptSelections: 0,
    compareWinners: 0,
    exports: 0,
    copies: 0,
    blockEdits: 0,
    blockRegenerations: 0,
    versionsSaved: 0,
    versionsRestored: 0,
    positiveFeedback: 0,
    negativeFeedback: 0,
    usefulnessRate: 0,
  }),
  events: signal([]),
  feedbackSummaryForConcept: jest.fn(() => ({
    positive: 0,
    negative: 0,
    topReason: '',
  })),
  logEvent: jest.fn(),
  recordConceptFeedback: jest.fn(),
});

describe('ResultsPageComponent', () => {
  it('renders offer bundle workspace framing with objective alignment and proof points', async () => {
    const request: GenerationRequest = {
      offeringKind: 'preset-app',
      selectedOfferingId: 'forgeofwill',
      customApp: {
        name: '',
        category: '',
        summary: '',
        features: '',
        differentiators: '',
        primaryGoal: '',
      },
      audienceId: 'technical-buyers',
      campaignIntent: 'awareness',
      channel: 'web',
      secondaryChannels: [],
      tone: 'technical',
      includeAiPolish: false,
      deliverables: [{ type: 'flyer', formatId: 'flyer-letter', quantity: 1 }],
      brand: {
        businessName: 'Forge of Will',
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

    const concepts: CampaignConcept[] = [
      {
        id: 'concept-1',
        angle: 'Operator command center',
        generationMode: 'template',
        generationProvenance: 'template-only',
        headline: 'Keep execution and context in one operating surface.',
        subheadline:
          'Built for operators who need direction, visible risk, and momentum.',
        cta: 'Explore the offer',
        channelLabel: 'Web landing concept',
        audienceLabel: 'Technical Buyers',
        sectionType: 'Narrative landing',
        positioning:
          'Execution operating system for focused operators and small teams.',
        valueProposition:
          'Keep plans, notes, risk, and active work visible enough to finish deliberately.',
        objectives: [
          'Position the app as an execution system',
          'Emphasize context retention',
        ],
        proofPoints: [
          'Projects, tasks, notes, and risk tracking stay connected',
          'AI support stays inside the workflow',
        ],
        deliveryModel: 'hosted',
        pricingModel: 'subscription-unlimited',
        selfHostedNote: 'Self-hosted Docker containers are also available.',
        sections: [
          { title: 'Objective alignment', body: 'Emphasize context retention' },
          {
            title: 'Proof points',
            body: 'Projects, tasks, notes, and risk tracking stay connected',
          },
          { title: 'Delivery model', body: 'Hosted' },
        ],
        channelOutputs: [
          {
            id: 'channel-1',
            type: 'landing-page',
            label: 'Landing page draft',
            summary: 'A web-first story arc.',
            isPrimary: true,
            blocks: [
              {
                id: 'b1',
                role: 'hero',
                label: 'Hero headline',
                value: 'Keep execution and context in one operating surface.',
              },
              {
                id: 'b2',
                role: 'supporting',
                label: 'Hero support',
                value: 'Built for focused operators.',
              },
            ],
          },
        ],
        materialOutputs: [
          {
            id: 'asset-1',
            type: 'flyer',
            formatId: 'flyer-letter',
            label: 'Letter Flyer',
            canvas: { width: 1275, height: 1650, unit: 'px', dpi: 150 },
            layoutVariant: 'hero-focus',
            surfaces: [
              {
                id: 'surface-1',
                label: 'Front',
                type: 'front',
                textBlocks: [
                  {
                    id: 'tb1',
                    role: 'headline',
                    label: 'Headline',
                    value:
                      'Keep execution and context in one operating surface.',
                  },
                ],
                imageSlots: [],
              },
            ],
            downloadFileName: 'forgeofwill-flyer',
            isPrimary: true,
          },
        ],
      },
    ];

    const stateStub = {
      request: signal(request),
      concepts: signal(concepts),
      setRequest: jest.fn(),
      setConcepts: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ResultsPageComponent],
      providers: [
        provideRouter([]),
        { provide: MarketingStateService, useValue: stateStub },
        {
          provide: MarketingGeneratorService,
          useValue: { generateConcepts: jest.fn() },
        },
        {
          provide: MarketingEnrichmentApiService,
          useValue: { enrichConcepts: jest.fn(), generateConcepts: jest.fn() },
        },
        { provide: MarketingInsightsService, useValue: buildInsightsStub() },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ResultsPageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Offer bundle workspace'
    );
    expect(fixture.nativeElement.textContent).toContain('Objective alignment');
    expect(fixture.nativeElement.textContent).toContain('Proof points');
    expect(fixture.nativeElement.textContent).toContain(
      'Emphasize context retention'
    );
  });

  it('renders delivery and pricing posture for the selected concept', async () => {
    const request: GenerationRequest = {
      offeringKind: 'preset-app',
      selectedOfferingId: 'billing-service',
      customApp: {
        name: '',
        category: '',
        summary: '',
        features: '',
        differentiators: '',
        primaryGoal: '',
      },
      audienceId: 'technical-buyers',
      campaignIntent: 'conversion',
      channel: 'web',
      secondaryChannels: [],
      tone: 'technical',
      includeAiPolish: false,
      deliverables: [{ type: 'flyer', formatId: 'flyer-letter', quantity: 1 }],
      brand: {
        businessName: 'Billing Service',
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

    const stateStub = {
      request: signal(request),
      concepts: signal([
        {
          id: 'billing-concept',
          angle: 'Hosted usage metering',
          generationMode: 'template',
          generationProvenance: 'ai-fallback',
          headline: 'Hosted metering without bespoke billing plumbing.',
          subheadline:
            'Usage blocks, invoice preview, and a self-hosted path stay available.',
          cta: 'Explore the offer',
          channelLabel: 'Web landing concept',
          audienceLabel: 'Technical Buyers',
          sectionType: 'Statement panel',
          positioning:
            'A hosted backend for metering, usage blocks, and invoice-preview orchestration.',
          valueProposition:
            'Adopt hosted billing infrastructure now and keep a Docker self-host option later.',
          objectives: ['Position hosted billing as a managed capability'],
          proofPoints: [
            'Usage blocks and invoice previews stay behind one backend surface',
          ],
          deliveryModel: 'hybrid',
          pricingModel: 'metered',
          selfHostedNote: 'Self-hosted Docker containers are available.',
          sections: [
            { title: 'Delivery model', body: 'Hybrid hosted and self-hosted' },
            { title: 'Pricing model', body: 'Metered usage' },
          ],
          channelOutputs: [
            {
              id: 'channel-1',
              type: 'landing-page',
              label: 'Landing page draft',
              summary: 'A hosted billing story.',
              isPrimary: true,
              blocks: [
                {
                  id: 'b1',
                  role: 'hero',
                  label: 'Hero headline',
                  value: 'Hosted metering without bespoke billing plumbing.',
                },
              ],
            },
            {
              id: 'channel-2',
              type: 'email-sequence',
              label: 'Email campaign draft',
              summary: 'A supporting nurture sequence.',
              isPrimary: false,
              blocks: [
                {
                  id: 'b2',
                  role: 'subject',
                  label: 'Email subject',
                  value: 'Hosted metering, without bespoke billing plumbing.',
                },
              ],
            },
          ],
          materialOutputs: [
            {
              id: 'asset-1',
              type: 'flyer',
              formatId: 'flyer-letter',
              label: 'Letter Flyer',
              canvas: { width: 1275, height: 1650, unit: 'px', dpi: 150 },
              layoutVariant: 'hero-focus',
              surfaces: [
                {
                  id: 'surface-1',
                  label: 'Front',
                  type: 'front',
                  textBlocks: [
                    {
                      id: 'tb1',
                      role: 'headline',
                      label: 'Headline',
                      value:
                        'Hosted metering without bespoke billing plumbing.',
                    },
                  ],
                  imageSlots: [],
                },
              ],
              downloadFileName: 'billing-service-flyer',
              isPrimary: true,
            },
          ],
        },
      ]),
      setRequest: jest.fn(),
      setConcepts: jest.fn(),
    };

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [ResultsPageComponent],
        providers: [
          provideRouter([]),
          { provide: MarketingStateService, useValue: stateStub },
          {
            provide: MarketingGeneratorService,
            useValue: { generateConcepts: jest.fn() },
          },
          {
            provide: MarketingEnrichmentApiService,
            useValue: {
              enrichConcepts: jest.fn(),
              generateConcepts: jest.fn(),
            },
          },
          { provide: MarketingInsightsService, useValue: buildInsightsStub() },
        ],
      })
      .compileComponents();

    const fixture = TestBed.createComponent(ResultsPageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Asset suite');
    expect(fixture.nativeElement.textContent).toContain('Delivery model');
    expect(fixture.nativeElement.textContent).toContain('Pricing model');
    expect(fixture.nativeElement.textContent).toContain('Self-hosted');
  });

  it('renders the ai-generated provenance label, description, and token usage', async () => {
    const request: GenerationRequest = {
      offeringKind: 'preset-app',
      selectedOfferingId: 'billing-service',
      customApp: {
        name: '',
        category: '',
        summary: '',
        features: '',
        differentiators: '',
        primaryGoal: '',
      },
      audienceId: 'technical-buyers',
      campaignIntent: 'conversion',
      channel: 'web',
      secondaryChannels: [],
      tone: 'technical',
      includeAiPolish: true,
      deliverables: [{ type: 'flyer', formatId: 'flyer-letter', quantity: 1 }],
      brand: {
        businessName: 'Billing Service',
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

    const stateStub = {
      request: signal(request),
      concepts: signal([
        {
          id: 'billing-concept',
          angle: 'Hosted usage metering',
          generationMode: 'llm',
          generationProvenance: 'ai-generated',
          headline: 'Hosted metering without bespoke billing plumbing.',
          subheadline:
            'Usage blocks, invoice preview, and a self-hosted path stay available.',
          cta: 'Explore the offer',
          channelLabel: 'Web landing concept',
          audienceLabel: 'Technical Buyers',
          sectionType: 'Statement panel',
          positioning:
            'A hosted backend for metering, usage blocks, and invoice-preview orchestration.',
          valueProposition:
            'Adopt hosted billing infrastructure now and keep a Docker self-host option later.',
          objectives: ['Position hosted billing as a managed capability'],
          proofPoints: [
            'Usage blocks and invoice previews stay behind one backend surface',
          ],
          deliveryModel: 'hybrid',
          pricingModel: 'metered',
          selfHostedNote: 'Self-hosted Docker containers are available.',
          sections: [
            { title: 'Delivery model', body: 'Hybrid hosted and self-hosted' },
            { title: 'Pricing model', body: 'Metered usage' },
          ],
          channelOutputs: [
            {
              id: 'channel-1',
              type: 'landing-page',
              label: 'Landing page draft',
              summary: 'A hosted billing story.',
              isPrimary: true,
              blocks: [
                {
                  id: 'b1',
                  role: 'hero',
                  label: 'Hero headline',
                  value: 'Hosted metering without bespoke billing plumbing.',
                },
              ],
            },
          ],
          materialOutputs: [],
        },
      ]),
      setRequest: jest.fn(),
      setConcepts: jest.fn(),
    };

    const insightsStub = {
      ...buildInsightsStub(),
      events: signal([
        {
          id: 'event-1',
          type: 'generation_requested',
          createdAt: new Date().toISOString(),
          metadata: {
            channel: 'web',
            promptTokens: 320,
            completionTokens: 96,
            model: 'gemma3',
          },
        },
      ]),
    };

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [ResultsPageComponent],
        providers: [
          provideRouter([]),
          { provide: MarketingStateService, useValue: stateStub },
          {
            provide: MarketingGeneratorService,
            useValue: { generateConcepts: jest.fn() },
          },
          {
            provide: MarketingEnrichmentApiService,
            useValue: {
              enrichConcepts: jest.fn(),
              generateConcepts: jest.fn(),
            },
          },
          { provide: MarketingInsightsService, useValue: insightsStub },
        ],
      })
      .compileComponents();

    const fixture = TestBed.createComponent(ResultsPageComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('AI-generated');
    expect(fixture.nativeElement.textContent).toContain('schema-validated');
    expect(fixture.nativeElement.textContent).toContain('Token usage');
    expect(fixture.nativeElement.textContent).toContain('320 prompt');
    expect(fixture.nativeElement.textContent).toContain('96 completion');
    expect(fixture.nativeElement.textContent).toContain('gemma3');
    expect(component.provenanceLabel('ai-generated')).toBe('AI-generated');
    expect(component.provenanceDescription('ai-generated')).toContain(
      'schema-validated'
    );
  });

  it('renders template preview shells with rich text and imagery editors', async () => {
    const request: GenerationRequest = {
      offeringKind: 'preset-app',
      selectedOfferingId: 'billing-service',
      customApp: {
        name: '',
        category: '',
        summary: '',
        features: '',
        differentiators: '',
        primaryGoal: '',
      },
      audienceId: 'technical-buyers',
      campaignIntent: 'conversion',
      channel: 'web',
      secondaryChannels: ['email'],
      tone: 'technical',
      includeAiPolish: false,
      deliverables: [{ type: 'flyer', formatId: 'flyer-letter', quantity: 1 }],
      brand: {
        businessName: 'Billing Service',
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

    const stateStub = {
      request: signal(request),
      concepts: signal([
        {
          id: 'billing-concept',
          angle: 'Hosted usage metering',
          generationMode: 'template',
          generationProvenance: 'ai-enriched',
          headline: 'Hosted metering without bespoke billing plumbing.',
          subheadline:
            'Usage blocks, invoice preview, and a self-hosted path stay available.',
          cta: 'Explore the offer',
          channelLabel: 'Web landing concept',
          audienceLabel: 'Technical Buyers',
          sectionType: 'Statement panel',
          positioning:
            'A hosted backend for metering, usage blocks, and invoice-preview orchestration.',
          valueProposition:
            'Adopt hosted billing infrastructure now and keep a Docker self-host option later.',
          objectives: ['Position hosted billing as a managed capability'],
          proofPoints: [
            'Usage blocks and invoice previews stay behind one backend surface',
          ],
          deliveryModel: 'hybrid',
          pricingModel: 'metered',
          selfHostedNote: 'Self-hosted Docker containers are available.',
          sections: [
            { title: 'Delivery model', body: 'Hybrid hosted and self-hosted' },
            { title: 'Pricing model', body: 'Metered usage' },
          ],
          channelOutputs: [
            {
              id: 'channel-1',
              type: 'landing-page',
              label: 'Landing page draft',
              summary: 'A hosted billing story.',
              isPrimary: true,
              blocks: [
                {
                  id: 'b1',
                  role: 'hero',
                  label: 'Hero headline',
                  value: 'Hosted metering without bespoke billing plumbing.',
                },
              ],
            },
            {
              id: 'channel-2',
              type: 'email-sequence',
              label: 'Email campaign draft',
              summary: 'A supporting nurture sequence.',
              isPrimary: false,
              blocks: [
                {
                  id: 'b2',
                  role: 'subject',
                  label: 'Email subject',
                  value: 'Hosted metering, without bespoke billing plumbing.',
                },
              ],
            },
          ],
          materialOutputs: [
            {
              id: 'asset-1',
              type: 'flyer',
              formatId: 'flyer-letter',
              label: 'Letter Flyer',
              canvas: { width: 1275, height: 1650, unit: 'px', dpi: 150 },
              layoutVariant: 'issue-led',
              templateFamily: 'print-flyer',
              templateName: 'issue-led',
              surfaces: [
                {
                  id: 'surface-1',
                  label: 'Front',
                  type: 'front',
                  textBlocks: [
                    {
                      id: 'tb1',
                      role: 'headline',
                      label: 'Headline',
                      value:
                        'Hosted metering without bespoke billing plumbing.',
                    },
                  ],
                  imageSlots: [
                    {
                      id: 'img-1',
                      prompt: 'Billing dashboard with usage trends',
                      alt: 'Billing dashboard hero image',
                      imageUrl: null,
                      status: 'prompt-ready',
                      imageBase64: null,
                      errorMessage: null,
                    },
                  ],
                },
              ],
              downloadFileName: 'billing-service-flyer',
              isPrimary: true,
            },
          ],
        },
      ]),
      setRequest: jest.fn(),
      setConcepts: jest.fn(),
    };

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [ResultsPageComponent],
        providers: [
          provideRouter([]),
          { provide: MarketingStateService, useValue: stateStub },
          {
            provide: MarketingGeneratorService,
            useValue: { generateConcepts: jest.fn() },
          },
          {
            provide: MarketingEnrichmentApiService,
            useValue: {
              enrichConcepts: jest.fn(),
              generateConcepts: jest.fn(),
            },
          },
          { provide: MarketingInsightsService, useValue: buildInsightsStub() },
        ],
      })
      .compileComponents();

    const fixture = TestBed.createComponent(ResultsPageComponent);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.template-preview')
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="tiptap-editor"]')
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Rendered image URL');
    expect(fixture.nativeElement.textContent).toContain('AI enriched');
    expect(fixture.nativeElement.textContent).toContain('Email campaign draft');
    expect(fixture.nativeElement.textContent).toContain('Download JSON bundle');
  });

  it('builds structured export metadata for the selected concept bundle', async () => {
    const request: GenerationRequest = {
      offeringKind: 'preset-app',
      selectedOfferingId: 'billing-service',
      customApp: {
        name: '',
        category: '',
        summary: '',
        features: '',
        differentiators: '',
        primaryGoal: '',
      },
      audienceId: 'technical-buyers',
      campaignIntent: 'conversion',
      channel: 'web',
      secondaryChannels: ['email'],
      tone: 'technical',
      includeAiPolish: true,
      deliverables: [{ type: 'flyer', formatId: 'flyer-letter', quantity: 1 }],
      brand: {
        businessName: 'Billing Service',
        tagline: '',
        primaryColor: '#f59e0b',
        secondaryColor: '#111827',
        accentColor: '#34d399',
        visualStyle: '',
        logoUrl: '',
      },
      visualDirection: '',
      generateImages: true,
    };

    const stateStub = {
      request: signal(request),
      concepts: signal([
        {
          id: 'billing-concept',
          angle: 'Hosted usage metering',
          generationMode: 'hybrid',
          generationProvenance: 'ai-enriched',
          headline: 'Hosted metering without bespoke billing plumbing.',
          subheadline:
            'Usage blocks, invoice preview, and a self-hosted path stay available.',
          cta: 'Explore the offer',
          channelLabel: 'Web landing concept',
          audienceLabel: 'Technical Buyers',
          sectionType: 'Statement panel',
          sections: [
            { title: 'Delivery model', body: 'Hybrid hosted and self-hosted' },
          ],
          channelOutputs: [
            {
              id: 'channel-1',
              type: 'landing-page',
              label: 'Landing page draft',
              summary: 'A hosted billing story.',
              isPrimary: true,
              blocks: [
                {
                  id: 'b1',
                  role: 'hero',
                  label: 'Hero headline',
                  value: 'Hosted metering without bespoke billing plumbing.',
                },
              ],
            },
            {
              id: 'channel-2',
              type: 'email-sequence',
              label: 'Email campaign draft',
              summary: 'A supporting nurture sequence.',
              isPrimary: false,
              blocks: [
                {
                  id: 'b2',
                  role: 'subject',
                  label: 'Email subject',
                  value: 'Hosted metering, without bespoke billing plumbing.',
                },
              ],
            },
          ],
          materialOutputs: [
            {
              id: 'asset-1',
              type: 'flyer',
              formatId: 'flyer-letter',
              label: 'Letter Flyer',
              canvas: { width: 1275, height: 1650, unit: 'px', dpi: 150 },
              layoutVariant: 'issue-led',
              templateFamily: 'print-flyer',
              templateName: 'issue-led',
              surfaces: [
                {
                  id: 'surface-1',
                  label: 'Front',
                  type: 'front',
                  textBlocks: [
                    {
                      id: 'tb1',
                      role: 'headline',
                      label: 'Headline',
                      value:
                        'Hosted metering without bespoke billing plumbing.',
                    },
                  ],
                  imageSlots: [
                    {
                      id: 'img1',
                      prompt: 'Prompt copy',
                      alt: 'Alt copy',
                      imageUrl: null,
                      status: 'prompt-ready',
                      imageBase64: null,
                      errorMessage: null,
                    },
                  ],
                },
              ],
              downloadFileName: 'billing-service-flyer',
              isPrimary: true,
            },
          ],
        },
      ]),
      setRequest: jest.fn(),
      setConcepts: jest.fn(),
    };

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [ResultsPageComponent],
        providers: [
          provideRouter([]),
          { provide: MarketingStateService, useValue: stateStub },
          {
            provide: MarketingGeneratorService,
            useValue: { generateConcepts: jest.fn() },
          },
          {
            provide: MarketingEnrichmentApiService,
            useValue: {
              enrichConcepts: jest.fn(),
              generateConcepts: jest.fn(),
            },
          },
          { provide: MarketingInsightsService, useValue: buildInsightsStub() },
        ],
      })
      .compileComponents();

    const fixture = TestBed.createComponent(ResultsPageComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const bundle = component.buildConceptExportBundle();

    expect(bundle.manifest.provenance).toBe('AI enriched');
    expect(bundle.manifest.channels).toEqual([
      'landing-page',
      'email-sequence',
    ]);
    expect(bundle.manifest.assets).toEqual(['billing-service-flyer.html']);
    expect(bundle.manifest.exportFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'channel-1.html',
          surface: 'channel',
        }),
        expect.objectContaining({
          path: 'channel-2.html',
          surface: 'channel',
        }),
        expect.objectContaining({
          path: 'billing-service-flyer.html',
          surface: 'material',
        }),
      ])
    );
    expect(bundle.json.files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        'billing-concept.md',
        'channel-1.html',
        'channel-2.html',
        'billing-service-flyer.html',
      ])
    );
    expect(bundle.json.request.secondaryChannels).toEqual(['email']);
  });

  it('supports selecting a winning concept and comparing two concepts side by side', async () => {
    const request: GenerationRequest = {
      offeringKind: 'preset-app',
      selectedOfferingId: 'forgeofwill',
      customApp: {
        name: '',
        category: '',
        summary: '',
        features: '',
        differentiators: '',
        primaryGoal: '',
      },
      audienceId: 'technical-buyers',
      campaignIntent: 'awareness',
      channel: 'web',
      secondaryChannels: [],
      tone: 'technical',
      includeAiPolish: false,
      deliverables: [{ type: 'flyer', formatId: 'flyer-letter', quantity: 1 }],
      brand: {
        businessName: 'Forge of Will',
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

    const concepts: CampaignConcept[] = [
      {
        id: 'concept-1',
        angle: 'Operator command center',
        generationMode: 'template',
        generationProvenance: 'template-only',
        workflowStatus: 'candidate',
        rubric: {
          clarity: 8,
          differentiation: 7,
          specificity: 8,
          actionability: 7,
        },
        headline: 'Keep execution and context in one operating surface.',
        subheadline:
          'Built for operators who need direction, visible risk, and momentum.',
        cta: 'Explore the offer',
        channelLabel: 'Web landing concept',
        audienceLabel: 'Technical Buyers',
        sectionType: 'Narrative landing',
        sections: [
          { title: 'Objective alignment', body: 'Emphasize context retention' },
        ],
        channelOutputs: [
          {
            id: 'channel-1',
            type: 'landing-page',
            label: 'Landing page draft',
            summary: 'A first concept output.',
            isPrimary: true,
            blocks: [
              {
                id: 'b1',
                role: 'hero',
                label: 'Hero headline',
                value: 'Keep execution and context in one operating surface.',
              },
              {
                id: 'b2',
                role: 'supporting',
                label: 'Hero support',
                value: 'Built for operators who need direction.',
              },
            ],
          },
        ],
        materialOutputs: [],
      },
      {
        id: 'concept-2',
        angle: 'Trust by proof',
        generationMode: 'template',
        generationProvenance: 'template-only',
        workflowStatus: 'candidate',
        rubric: {
          clarity: 7,
          differentiation: 8,
          specificity: 7,
          actionability: 8,
        },
        headline:
          'Show the system in plain language instead of vague promises.',
        subheadline: 'Proof-led framing for technical buyers.',
        cta: 'Explore the offer',
        channelLabel: 'Web landing concept',
        audienceLabel: 'Technical Buyers',
        sectionType: 'Proof grid',
        sections: [{ title: 'Proof points', body: 'Concrete proof copy' }],
        channelOutputs: [
          {
            id: 'channel-1',
            type: 'landing-page',
            label: 'Landing page draft',
            summary: 'A proof-led concept output.',
            isPrimary: true,
            blocks: [
              {
                id: 'b1',
                role: 'hero',
                label: 'Hero headline',
                value:
                  'Show the system in plain language instead of vague promises.',
              },
              {
                id: 'b2',
                role: 'supporting',
                label: 'Hero support',
                value: 'Proof-led framing for technical buyers.',
              },
            ],
          },
        ],
        materialOutputs: [],
      },
    ];

    const stateStub = {
      request: signal(request),
      concepts: signal(concepts),
      workspaces: signal([
        {
          id: 'workspace-1',
          name: 'Current Workspace',
          createdAt: '2026-05-26T12:00:00.000Z',
          updatedAt: '2026-05-26T12:00:00.000Z',
          request,
          concepts,
          selectedConceptId: 'concept-1',
          versions: [
            {
              id: 'version-1',
              name: 'Initial version',
              createdAt: '2026-05-26T12:00:00.000Z',
              request,
              concepts,
              selectedConceptId: 'concept-1',
            },
          ],
        },
      ]),
      currentWorkspace: jest.fn(() => ({
        id: 'workspace-1',
        name: 'Current Workspace',
        createdAt: '2026-05-26T12:00:00.000Z',
        updatedAt: '2026-05-26T12:00:00.000Z',
        request,
        concepts,
        selectedConceptId: 'concept-1',
        versions: [
          {
            id: 'version-1',
            name: 'Initial version',
            createdAt: '2026-05-26T12:00:00.000Z',
            request,
            concepts,
            selectedConceptId: 'concept-1',
          },
        ],
      })),
      currentWorkspaceId: signal(''),
      setRequest: jest.fn(),
      setConcepts: jest.fn(),
      setSelectedConceptId: jest.fn(),
      patchConcept: jest.fn(),
      createWorkspace: jest.fn(),
      renameCurrentWorkspace: jest.fn(),
      duplicateCurrentWorkspace: jest.fn(),
      saveWorkspaceVersion: jest.fn(),
      restoreWorkspaceVersion: jest.fn(),
      setDecisionSummary: jest.fn(),
      selectWorkspace: jest.fn(),
    };
    const insightsStub = {
      summary: signal({
        generationRuns: 1,
        conceptSelections: 0,
        compareWinners: 0,
        exports: 0,
        copies: 0,
        blockEdits: 0,
        blockRegenerations: 0,
        versionsSaved: 0,
        versionsRestored: 0,
        positiveFeedback: 0,
        negativeFeedback: 0,
        usefulnessRate: 0,
      }),
      events: signal([]),
      feedbackSummaryForConcept: jest.fn(() => ({
        positive: 0,
        negative: 0,
        topReason: '',
      })),
      logEvent: jest.fn(),
      recordConceptFeedback: jest.fn(),
    };

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [ResultsPageComponent],
        providers: [
          provideRouter([]),
          { provide: MarketingStateService, useValue: stateStub },
          {
            provide: MarketingGeneratorService,
            useValue: {
              generateConcepts: jest.fn(),
              regenerateChannelBlock: jest
                .fn()
                .mockResolvedValue('Refined email headline for Fin Commander'),
            },
          },
          {
            provide: MarketingEnrichmentApiService,
            useValue: {
              enrichConcepts: jest.fn(),
              generateConcepts: jest.fn(),
            },
          },
          { provide: MarketingInsightsService, useValue: insightsStub },
        ],
      })
      .compileComponents();

    const fixture = TestBed.createComponent(ResultsPageComponent);
    const component = fixture.componentInstance;

    component.markConceptSelected('concept-2');
    component.toggleCompareConcept('concept-1');
    component.toggleCompareConcept('concept-2');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Compare concepts');
    expect(fixture.nativeElement.textContent).toContain('Clarity');

    component.chooseComparedWinner('concept-2');
    fixture.detectChanges();

    expect(stateStub.setConcepts).toHaveBeenCalled();
    expect(stateStub.setDecisionSummary).toHaveBeenCalledWith(
      'Winner chosen: Show the system in plain language instead of vague promises. over 1 compared option.'
    );
    expect(stateStub.saveWorkspaceVersion).toHaveBeenCalled();
    component.submitConceptFeedback('positive', 'strongest-direction');
    await component.regenerateSelectedChannelBlock('channel-1', 'b2');
    expect(insightsStub.recordConceptFeedback).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      conceptId: 'concept-2',
      sentiment: 'positive',
      reason: 'strongest-direction',
    });
    expect(insightsStub.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'block_regenerated',
        blockId: 'b2',
      })
    );
    expect(fixture.nativeElement.textContent).toContain('Selected direction');
    expect(fixture.nativeElement.textContent).toContain('Version history');
  });

  it('renders a preview-first dual pane editor with first-class output surfaces', async () => {
    const request: GenerationRequest = {
      offeringKind: 'preset-app',
      selectedOfferingId: 'forgeofwill',
      customApp: {
        name: '',
        category: '',
        summary: '',
        features: '',
        differentiators: '',
        primaryGoal: '',
      },
      audienceId: 'technical-buyers',
      campaignIntent: 'awareness',
      channel: 'web',
      secondaryChannels: ['email', 'social'],
      tone: 'technical',
      includeAiPolish: false,
      deliverables: [{ type: 'flyer', formatId: 'flyer-letter', quantity: 1 }],
      brand: {
        businessName: 'Forge of Will',
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

    const concepts: CampaignConcept[] = [
      {
        id: 'concept-1',
        angle: 'Operator clarity',
        generationMode: 'template',
        generationProvenance: 'template-only',
        workflowStatus: 'selected',
        headline: 'Keep execution and context in one operating surface.',
        subheadline:
          'Built for operators who need direction, visible risk, and momentum.',
        cta: 'Explore the offer',
        channelLabel: 'Web landing concept',
        audienceLabel: 'Technical Buyers',
        sectionType: 'Narrative landing',
        sections: [
          { title: 'Positioning', body: 'Operator-first execution workflow.' },
        ],
        channelOutputs: [
          {
            id: 'web-output',
            type: 'landing-page',
            label: 'Landing page draft',
            summary: 'A web-first story arc.',
            isPrimary: true,
            blocks: [
              {
                id: 'web-hero',
                role: 'hero',
                label: 'Hero headline',
                value: 'Keep execution and context in one operating surface.',
              },
              {
                id: 'web-support',
                role: 'supporting',
                label: 'Hero support',
                value:
                  'Built for operators who need direction, visible risk, and momentum.',
              },
              {
                id: 'web-proof',
                role: 'proof',
                label: 'Proof strip',
                value:
                  'Projects, tasks, notes, and risk tracking stay connected.',
              },
              {
                id: 'web-cta',
                role: 'cta',
                label: 'Primary CTA',
                value: 'Explore the offer',
              },
            ],
          },
          {
            id: 'email-output',
            type: 'email-sequence',
            label: 'Email sequence draft',
            summary: 'A supporting nurture sequence.',
            isPrimary: false,
            blocks: [
              {
                id: 'email-subject',
                role: 'subject',
                label: 'Email subject',
                value: 'Keep execution and context in one operating surface.',
              },
              {
                id: 'email-preview',
                role: 'preview',
                label: 'Preview line',
                value:
                  'Built for operators who need direction and visible risk.',
              },
              {
                id: 'email-body',
                role: 'supporting',
                label: 'Email body',
                value:
                  'Keep plans, notes, risk, and active work visible enough to finish deliberately.',
              },
              {
                id: 'email-cta',
                role: 'cta',
                label: 'Email CTA',
                value: 'Explore the offer',
              },
            ],
          },
          {
            id: 'social-output',
            type: 'social-campaign',
            label: 'Social campaign draft',
            summary: 'A social-first campaign set.',
            isPrimary: false,
            blocks: [
              {
                id: 'social-hook',
                role: 'hook',
                label: 'Social hook',
                value: 'Keep execution and context in one operating surface.',
              },
              {
                id: 'social-caption',
                role: 'caption',
                label: 'Primary caption',
                value:
                  'Built for operators who need direction, visible risk, and momentum.',
              },
              {
                id: 'social-proof',
                role: 'proof',
                label: 'Proof line',
                value:
                  'Projects, tasks, notes, and risk tracking stay connected.',
              },
              {
                id: 'social-cta',
                role: 'cta',
                label: 'Social CTA',
                value: 'Explore the offer',
              },
            ],
          },
        ],
        materialOutputs: [
          {
            id: 'asset-1',
            type: 'flyer',
            formatId: 'flyer-letter',
            label: 'Letter Flyer',
            canvas: { width: 1275, height: 1650, unit: 'px', dpi: 150 },
            layoutVariant: 'hero-focus',
            surfaces: [
              {
                id: 'surface-1',
                label: 'Front',
                type: 'front',
                textBlocks: [
                  {
                    id: 'tb1',
                    role: 'headline',
                    label: 'Headline',
                    value:
                      'Keep execution and context in one operating surface.',
                  },
                  {
                    id: 'tb2',
                    role: 'body',
                    label: 'Body',
                    value:
                      'Projects, tasks, notes, and risk tracking stay connected.',
                  },
                ],
                imageSlots: [],
              },
            ],
            downloadFileName: 'forgeofwill-flyer',
            isPrimary: true,
          },
        ],
      },
    ];

    const stateStub = {
      request: signal(request),
      concepts: signal(concepts),
      workspaces: signal([]),
      currentWorkspace: jest.fn(() => null),
      currentWorkspaceId: signal(''),
      setRequest: jest.fn(),
      setConcepts: jest.fn(),
      setSelectedConceptId: jest.fn(),
    };

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [ResultsPageComponent],
        providers: [
          provideRouter([]),
          { provide: MarketingStateService, useValue: stateStub },
          {
            provide: MarketingGeneratorService,
            useValue: {
              generateConcepts: jest.fn(),
              regenerateChannelBlock: jest.fn(),
              regenerateMaterialTextBlock: jest.fn(),
            },
          },
          {
            provide: MarketingEnrichmentApiService,
            useValue: {
              enrichConcepts: jest.fn(),
              generateConcepts: jest.fn(),
            },
          },
          {
            provide: MarketingInsightsService,
            useValue: {
              summary: signal({
                generationRuns: 1,
                conceptSelections: 1,
                compareWinners: 0,
                exports: 0,
                copies: 0,
                blockEdits: 0,
                blockRegenerations: 0,
                versionsSaved: 0,
                versionsRestored: 0,
                positiveFeedback: 0,
                negativeFeedback: 0,
                usefulnessRate: 0,
              }),
              events: signal([]),
              feedbackSummaryForConcept: jest.fn(() => ({
                positive: 0,
                negative: 0,
                topReason: '',
              })),
              logEvent: jest.fn(),
              recordConceptFeedback: jest.fn(),
            },
          },
        ],
      })
      .compileComponents();

    const fixture = TestBed.createComponent(ResultsPageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Preview workspace');
    expect(fixture.nativeElement.textContent).toContain('Inspector');
    expect(fixture.nativeElement.textContent).toContain('Landing page draft');
    expect(fixture.nativeElement.textContent).toContain('Email sequence draft');
    expect(fixture.nativeElement.textContent).toContain(
      'Social campaign draft'
    );
    expect(fixture.nativeElement.textContent).toContain('Letter Flyer');
  });

  it('renders workspace operating status and provenance guidance', async () => {
    const request: GenerationRequest = {
      offeringKind: 'preset-app',
      selectedOfferingId: 'billing-service',
      customApp: {
        name: '',
        category: '',
        summary: '',
        features: '',
        differentiators: '',
        primaryGoal: '',
      },
      audienceId: 'technical-buyers',
      campaignIntent: 'conversion',
      channel: 'web',
      secondaryChannels: [],
      tone: 'technical',
      includeAiPolish: true,
      deliverables: [{ type: 'flyer', formatId: 'flyer-letter', quantity: 1 }],
      brand: {
        businessName: 'Billing Service',
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

    const stateStub = {
      request: signal(request),
      concepts: signal([
        {
          id: 'billing-concept',
          angle: 'Hosted usage metering',
          generationMode: 'template',
          generationProvenance: 'ai-fallback',
          headline: 'Hosted metering without bespoke billing plumbing.',
          subheadline:
            'Usage blocks, invoice preview, and a self-hosted path stay available.',
          cta: 'Explore the offer',
          channelLabel: 'Web landing concept',
          audienceLabel: 'Technical Buyers',
          sectionType: 'Statement panel',
          sections: [
            { title: 'Delivery model', body: 'Hybrid hosted and self-hosted' },
          ],
          channelOutputs: [
            {
              id: 'channel-1',
              type: 'landing-page',
              label: 'Landing page draft',
              summary: 'A hosted billing story.',
              isPrimary: true,
              blocks: [
                {
                  id: 'b1',
                  role: 'hero',
                  label: 'Hero headline',
                  value: 'Hosted metering without bespoke billing plumbing.',
                },
              ],
            },
          ],
          materialOutputs: [],
        },
      ]),
      setRequest: jest.fn(),
      setConcepts: jest.fn(),
      workspaceStatus: signal({
        storageLabel: 'Browser storage only',
        currentWorkspaceName: 'Billing Flow',
        workspaceCount: 1,
        currentVersionCount: 2,
        conceptCount: 1,
        lastSavedAt: '2026-06-04T12:00:00.000Z',
      }),
    };

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [ResultsPageComponent],
        providers: [
          provideRouter([]),
          { provide: MarketingStateService, useValue: stateStub },
          {
            provide: MarketingGeneratorService,
            useValue: { generateConcepts: jest.fn() },
          },
          {
            provide: MarketingEnrichmentApiService,
            useValue: {
              enrichConcepts: jest.fn(),
              generateConcepts: jest.fn(),
            },
          },
          { provide: MarketingInsightsService, useValue: buildInsightsStub() },
        ],
      })
      .compileComponents();

    const fixture = TestBed.createComponent(ResultsPageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Operating status');
    expect(fixture.nativeElement.textContent).toContain('Billing Flow');
    expect(fixture.nativeElement.textContent).toContain('AI fallback');
    expect(fixture.nativeElement.textContent).toContain(
      'Template-safe copy is in place because enrichment was unavailable for this run.'
    );
  });
});
