import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ResultsPageComponent } from './results-page.component';
import { MarketingEnrichmentApiService } from '../services/marketing-enrichment-api.service';
import { MarketingStateService } from '../services/marketing-state.service';
import { MarketingGeneratorService } from '../services/marketing-generator.service';

describe('ResultsPageComponent', () => {
  it('renders asset cards for the selected concept', async () => {
    await TestBed.configureTestingModule({
      imports: [ResultsPageComponent],
      providers: [
        provideRouter([]),
        MarketingStateService,
        MarketingGeneratorService,
        {
          provide: MarketingEnrichmentApiService,
          useValue: {
            enrichConcepts: jest.fn(),
          },
        },
      ],
    }).compileComponents();

    const state = TestBed.inject(MarketingStateService);
    const generator = TestBed.inject(MarketingGeneratorService);
    const concepts = await generator.generateConcepts(state.request());
    state.setConcepts(concepts);

    const fixture = TestBed.createComponent(ResultsPageComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Material outputs');
    expect(compiled.querySelectorAll('.material-card').length).toBeGreaterThanOrEqual(1);
  });

  it('renders grouped channel and material outputs for the selected concept', async () => {
    await TestBed.configureTestingModule({
      imports: [ResultsPageComponent],
      providers: [
        provideRouter([]),
        MarketingStateService,
        MarketingGeneratorService,
        {
          provide: MarketingEnrichmentApiService,
          useValue: {
            enrichConcepts: jest.fn(),
          },
        },
      ],
    }).compileComponents();

    const state = TestBed.inject(MarketingStateService);
    const generator = TestBed.inject(MarketingGeneratorService);
    const concepts = await generator.generateConcepts({
      ...state.request(),
      deliverables: [
        { type: 'flyer', formatId: 'flyer-letter', quantity: 1 },
        { type: 'web-ad', formatId: 'web-ad-square', quantity: 1 },
      ],
    });
    state.setConcepts(concepts);

    const fixture = TestBed.createComponent(ResultsPageComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Channel outputs');
    expect(compiled.textContent).toContain('Material outputs');
    expect(compiled.textContent).toContain('Letter Flyer');
    expect(compiled.textContent).toContain(
      concepts[0].materialOutputs[0].surfaces[0].textBlocks[0].value
    );
  });

  it('lets the user edit a channel output block and updates the preview', async () => {
    await TestBed.configureTestingModule({
      imports: [ResultsPageComponent],
      providers: [
        provideRouter([]),
        MarketingStateService,
        MarketingGeneratorService,
        {
          provide: MarketingEnrichmentApiService,
          useValue: {
            enrichConcepts: jest.fn(),
          },
        },
      ],
    }).compileComponents();

    const state = TestBed.inject(MarketingStateService);
    const generator = TestBed.inject(MarketingGeneratorService);
    const concepts = await generator.generateConcepts(state.request());
    state.setConcepts(concepts);

    const fixture = TestBed.createComponent(ResultsPageComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const output = concepts[0].channelOutputs[0];
    const block = output.blocks[0];

    component.selectChannelOutput(output.id);
    component.updateChannelBlock(output.id, block.id, 'Rewritten hero line');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Rewritten hero line');
    expect(state.concepts()[0].channelOutputs[0].blocks[0].value).toBe(
      'Rewritten hero line'
    );
  });

  it('lets the user edit a material text block and updates the persisted concept', async () => {
    await TestBed.configureTestingModule({
      imports: [ResultsPageComponent],
      providers: [
        provideRouter([]),
        MarketingStateService,
        MarketingGeneratorService,
        {
          provide: MarketingEnrichmentApiService,
          useValue: {
            enrichConcepts: jest.fn(),
          },
        },
      ],
    }).compileComponents();

    const state = TestBed.inject(MarketingStateService);
    const generator = TestBed.inject(MarketingGeneratorService);
    const concepts = await generator.generateConcepts(state.request());
    state.setConcepts(concepts);

    const fixture = TestBed.createComponent(ResultsPageComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const material = concepts[0].materialOutputs[0];
    const surface = material.surfaces[0];
    const block = surface.textBlocks[0];

    component.selectMaterialOutput(material.id, surface.id);
    component.updateMaterialTextBlock(material.id, surface.id, block.id, 'Flyer hero rewrite');
    fixture.detectChanges();

    expect(
      state.concepts()[0].materialOutputs[0].surfaces[0].textBlocks[0].value
    ).toBe('Flyer hero rewrite');
  });
});
