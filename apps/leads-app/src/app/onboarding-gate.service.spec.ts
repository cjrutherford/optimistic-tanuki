import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { LeadsService } from './leads.service';
import {
  OnboardingGateService,
  onboardingPageGuard,
  onboardingPageMatchGuard,
  onboardingRequiredGuard,
  onboardingRequiredMatchGuard,
} from './onboarding-gate.service';
import { provideRouter, Router } from '@angular/router';
import { appRoutes } from './app.routes';

describe('OnboardingGateService', () => {
  const leadsServiceStub = {
    getStats: jest.fn(),
    getTopics: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        OnboardingGateService,
        {
          provide: LeadsService,
          useValue: leadsServiceStub,
        },
      ],
    });
  });

  it('requires onboarding for an empty workspace', (done) => {
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

    const service = TestBed.inject(OnboardingGateService);

    service.getState().subscribe((state) => {
      expect(state.requiresOnboarding).toBe(true);
      expect(state.topicCount).toBe(0);
      done();
    });
  });

  it('marks onboarding complete after confirmation', (done) => {
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

    const service = TestBed.inject(OnboardingGateService);

    service.markComplete();

    service.getState().subscribe((state) => {
      expect(state.requiresOnboarding).toBe(false);
      done();
    });
  });

  it('redirects protected routes to onboarding when setup is required', (done) => {
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

    const router = TestBed.inject(Router);

    TestBed.runInInjectionContext(() => {
      const result$ = onboardingRequiredGuard({} as never, {} as never);
      (result$ as ReturnType<typeof of>).subscribe((result) => {
        expect(result).toEqual(router.createUrlTree(['/onboarding']));
        done();
      });
    });
  });

  it('redirects onboarding back to dashboard when setup is already complete', (done) => {
    leadsServiceStub.getStats.mockReturnValue(
      of({
        total: 4,
        autoDiscovered: 1,
        manual: 3,
        totalValue: 1000,
        followUpsDue: 0,
        byStatus: {},
        qualification: {
          byClassification: {
            'strong-match': 1,
            review: 2,
            'weak-match': 1,
          },
          averageRelevanceScore: 70,
          averageDifficultyScore: 60,
          averageUserFitScore: 75,
          missingUserFitCount: 0,
        },
      })
    );
    leadsServiceStub.getTopics.mockReturnValue(
      of([
        {
          id: 'topic-1',
          name: 'React',
          description: 'React work',
          keywords: ['react'],
          excludedTerms: [],
          enabled: true,
          leadCount: 0,
        },
      ])
    );

    const router = TestBed.inject(Router);

    TestBed.runInInjectionContext(() => {
      const result$ = onboardingPageGuard({} as never, {} as never);
      (result$ as ReturnType<typeof of>).subscribe((result) => {
        expect(result).toEqual(router.createUrlTree(['/']));
        done();
      });
    });
  });

  it('blocks protected routes at match time to avoid dashboard flashes', () => {
    const protectedRoutes = appRoutes.filter((route) =>
      ['dashboard', 'leads', 'topics', 'analytics'].includes(route.path ?? '')
    );

    expect(protectedRoutes).toHaveLength(4);

    for (const route of protectedRoutes) {
      expect(route.canMatch).toContain(onboardingRequiredMatchGuard);
    }
  });

  it('blocks the onboarding route at match time once setup is complete', () => {
    const onboardingRoute = appRoutes.find((route) => route.path === 'onboarding');

    expect(onboardingRoute?.canMatch).toContain(onboardingPageMatchGuard);
  });
});
