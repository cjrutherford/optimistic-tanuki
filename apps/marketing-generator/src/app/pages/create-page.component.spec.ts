import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CreatePageComponent } from './create-page.component';
import { MarketingStateService } from '../services/marketing-state.service';
import { MarketingGeneratorService } from '../services/marketing-generator.service';
import { MarketingEnrichmentApiService } from '../services/marketing-enrichment-api.service';
import { MarketingInsightsService } from '../services/marketing-insights.service';

describe('CreatePageComponent', () => {
  it('shows offer brief framing and message context for the selected preset offering', async () => {
    await TestBed.configureTestingModule({
      imports: [CreatePageComponent],
      providers: [
        provideRouter([]),
        MarketingStateService,
        MarketingGeneratorService,
        {
          provide: MarketingEnrichmentApiService,
          useValue: { enrichConcepts: jest.fn(), generateConcepts: jest.fn() },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CreatePageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Offer brief');
    expect(fixture.nativeElement.textContent).toContain('Message context');
    expect(fixture.nativeElement.textContent).toContain('Positioning snapshot');
  });

  it('shows delivery and pricing details for service and package offerings', async () => {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [CreatePageComponent],
        providers: [
          provideRouter([]),
          MarketingStateService,
          MarketingGeneratorService,
          {
            provide: MarketingEnrichmentApiService,
            useValue: {
              enrichConcepts: jest.fn(),
              generateConcepts: jest.fn(),
            },
          },
        ],
      })
      .compileComponents();

    const state = TestBed.inject(MarketingStateService);
    state.setRequest({
      ...state.request(),
      selectedOfferingId: 'billing-service',
      audienceId: 'technical-buyers',
    });

    const fixture = TestBed.createComponent(CreatePageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Delivery model');
    expect(fixture.nativeElement.textContent).toContain('Pricing model');
    expect(fixture.nativeElement.textContent).toContain('Self-hosted');
  });

  it('shows bundled channel output selections in the bundle scope summary', async () => {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [CreatePageComponent],
        providers: [
          provideRouter([]),
          MarketingStateService,
          MarketingGeneratorService,
          {
            provide: MarketingEnrichmentApiService,
            useValue: {
              enrichConcepts: jest.fn(),
              generateConcepts: jest.fn(),
            },
          },
        ],
      })
      .compileComponents();

    const state = TestBed.inject(MarketingStateService);
    state.setRequest({
      ...state.request(),
      channel: 'web',
      secondaryChannels: ['email', 'social'],
    });

    const fixture = TestBed.createComponent(CreatePageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Bundle scope');
    expect(fixture.nativeElement.textContent).toContain('Bundled channels');
    expect(fixture.nativeElement.textContent).toContain('Web, Email, Social');
  });

  it('marks concepts ai-generated and records token usage when LLM authorship succeeds', async () => {
    const generateConcepts = jest
      .fn()
      .mockImplementation(async (_request, concepts) => ({
        concepts: concepts.map((concept: { generationMode: string }) => ({
          ...concept,
          generationMode: 'llm',
        })),
        generationApplied: true,
        usage: {
          model: 'gemma3',
          promptTokens: 200,
          completionTokens: 80,
          totalDurationMs: 1500,
        },
      }));

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [CreatePageComponent],
        providers: [
          provideRouter([
            { path: 'offers/:offerId', component: CreatePageComponent },
          ]),
          MarketingStateService,
          MarketingGeneratorService,
          {
            provide: MarketingEnrichmentApiService,
            useValue: { enrichConcepts: jest.fn(), generateConcepts },
          },
        ],
      })
      .compileComponents();

    const state = TestBed.inject(MarketingStateService);
    const insights = TestBed.inject(MarketingInsightsService);
    const logEventSpy = jest.spyOn(insights, 'logEvent');
    state.setRequest({ ...state.request(), includeAiPolish: true });

    const fixture = TestBed.createComponent(CreatePageComponent);
    fixture.detectChanges();

    await fixture.componentInstance.generate();

    expect(generateConcepts).toHaveBeenCalled();
    const concepts = state.concepts();
    expect(concepts.length).toBeGreaterThan(0);
    expect(
      concepts.every(
        (concept) => concept.generationProvenance === 'ai-generated'
      )
    ).toBe(true);
    expect(logEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'generation_requested',
        metadata: expect.objectContaining({
          promptTokens: 200,
          completionTokens: 80,
          model: 'gemma3',
        }),
      })
    );
  });

  it('marks concepts ai-fallback when LLM authorship is unavailable', async () => {
    const generateConcepts = jest
      .fn()
      .mockImplementation(async (_request, concepts) => ({
        concepts,
        generationApplied: false,
        usage: null,
      }));

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [CreatePageComponent],
        providers: [
          provideRouter([
            { path: 'offers/:offerId', component: CreatePageComponent },
          ]),
          MarketingStateService,
          MarketingGeneratorService,
          {
            provide: MarketingEnrichmentApiService,
            useValue: { enrichConcepts: jest.fn(), generateConcepts },
          },
        ],
      })
      .compileComponents();

    const state = TestBed.inject(MarketingStateService);
    state.setRequest({ ...state.request(), includeAiPolish: true });

    const fixture = TestBed.createComponent(CreatePageComponent);
    fixture.detectChanges();

    await fixture.componentInstance.generate();

    expect(generateConcepts).toHaveBeenCalled();
    const concepts = state.concepts();
    expect(concepts.length).toBeGreaterThan(0);
    expect(
      concepts.every(
        (concept) => concept.generationProvenance === 'ai-fallback'
      )
    ).toBe(true);
  });

  it('marks concepts template-only and skips LLM authorship when AI polish is disabled', async () => {
    const generateConcepts = jest.fn();

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [CreatePageComponent],
        providers: [
          provideRouter([
            { path: 'offers/:offerId', component: CreatePageComponent },
          ]),
          MarketingStateService,
          MarketingGeneratorService,
          {
            provide: MarketingEnrichmentApiService,
            useValue: { enrichConcepts: jest.fn(), generateConcepts },
          },
        ],
      })
      .compileComponents();

    const state = TestBed.inject(MarketingStateService);
    state.setRequest({ ...state.request(), includeAiPolish: false });

    const fixture = TestBed.createComponent(CreatePageComponent);
    fixture.detectChanges();

    await fixture.componentInstance.generate();

    expect(generateConcepts).not.toHaveBeenCalled();
    const concepts = state.concepts();
    expect(concepts.length).toBeGreaterThan(0);
    expect(
      concepts.every(
        (concept) => concept.generationProvenance === 'template-only'
      )
    ).toBe(true);
  });
});
