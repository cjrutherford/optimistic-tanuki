import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CreatePageComponent } from './create-page.component';
import { MarketingStateService } from '../services/marketing-state.service';
import { MarketingGeneratorService } from '../services/marketing-generator.service';
import { MarketingEnrichmentApiService } from '../services/marketing-enrichment-api.service';

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
          useValue: { enrichConcepts: jest.fn() },
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
            useValue: { enrichConcepts: jest.fn() },
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
            useValue: { enrichConcepts: jest.fn() },
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
});
