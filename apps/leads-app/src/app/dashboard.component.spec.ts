import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { LeadsService } from './leads.service';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

describe('DashboardComponent', () => {
  const leadsServiceStub = {
    getStats: jest.fn(),
    getTopics: jest.fn(),
  };

  const themeServiceStub = {
    setPersonality: jest.fn(),
    themeColors$: of({
      background: '#111111',
      foreground: '#ffffff',
      accent: '#22c55e',
      complementary: '#0f172a',
      complementaryGradients: { light: 'linear-gradient(#111111, #222222)' },
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        {
          provide: LeadsService,
          useValue: leadsServiceStub,
        },
        {
          provide: ThemeService,
          useValue: themeServiceStub,
        },
      ],
    }).compileComponents();
  });

  it('shows the onboarding prompt when the workspace has no leads or topics', () => {
    leadsServiceStub.getStats.mockReturnValue(
      of({
        total: 0,
        autoDiscovered: 0,
        manual: 0,
        totalValue: 0,
        followUpsDue: 0,
        byStatus: {},
        qualification: {
          byClassification: {
            'strong-match': 0,
            review: 0,
            'weak-match': 0,
          },
          averageRelevanceScore: null,
          averageDifficultyScore: null,
          averageUserFitScore: null,
          missingUserFitCount: 0,
        },
      })
    );
    leadsServiceStub.getTopics.mockReturnValue(of([]));

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Complete onboarding to begin discovery'
    );
    expect(fixture.nativeElement.textContent).toContain('Open Onboarding');
  });

  it('renders the dashboard metrics when workspace data exists', () => {
    leadsServiceStub.getStats.mockReturnValue(
      of({
        total: 12,
        autoDiscovered: 5,
        manual: 7,
        totalValue: 42000,
        followUpsDue: 3,
        byStatus: {
          new: 4,
          contacted: 3,
          won: 2,
        },
        qualification: {
          byClassification: {
            'strong-match': 4,
            review: 6,
            'weak-match': 2,
          },
          averageRelevanceScore: 78,
          averageDifficultyScore: 61,
          averageUserFitScore: 84,
          missingUserFitCount: 1,
        },
      })
    );
    leadsServiceStub.getTopics.mockReturnValue(
      of([
        {
          id: 'topic-1',
          name: 'React opportunities',
          description: 'React work',
          keywords: ['react'],
          excludedTerms: [],
          enabled: true,
          leadCount: 0,
        },
      ])
    );

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('12');
    expect(fixture.nativeElement.textContent).toContain('Pipeline Value');
    expect(fixture.nativeElement.textContent).toContain('Strong Matches');
    expect(fixture.nativeElement.textContent).toContain('Avg Relevance');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Complete onboarding to begin discovery'
    );
  });
});
