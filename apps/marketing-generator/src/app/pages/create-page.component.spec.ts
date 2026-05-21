import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { CreatePageComponent } from './create-page.component';
import { MarketingEnrichmentApiService } from '../services/marketing-enrichment-api.service';
import { MarketingStateService } from '../services/marketing-state.service';

describe('CreatePageComponent', () => {
  it('shows the custom app brief form when custom app mode is active', async () => {
    await TestBed.configureTestingModule({
      imports: [CreatePageComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {},
        },
        {
          provide: MarketingEnrichmentApiService,
          useValue: {
            enrichConcepts: jest.fn(),
          },
        },
        MarketingStateService,
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CreatePageComponent);
    const component = fixture.componentInstance;

    component.selectCustomApp();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Custom app brief');
  });

  it('blocks moving forward when the custom app brief is incomplete', async () => {
    await TestBed.configureTestingModule({
      imports: [CreatePageComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {},
        },
        {
          provide: MarketingEnrichmentApiService,
          useValue: {
            enrichConcepts: jest.fn(),
          },
        },
        MarketingStateService,
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CreatePageComponent);
    const component = fixture.componentInstance;

    component.selectCustomApp();
    fixture.detectChanges();

    const nextButton = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    ).find((button: HTMLButtonElement) => button.textContent?.includes('Next'));

    expect(nextButton?.hasAttribute('disabled')).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Complete the custom app brief');
  });

  it('exposes output and brand configuration steps in the studio flow', async () => {
    await TestBed.configureTestingModule({
      imports: [CreatePageComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {},
        },
        {
          provide: MarketingEnrichmentApiService,
          useValue: {
            enrichConcepts: jest.fn(),
          },
        },
        MarketingStateService,
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CreatePageComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Outputs');
    expect(compiled.textContent).toContain('Brand');
  });
});
