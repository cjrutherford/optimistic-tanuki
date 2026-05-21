import { Injectable, inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router, UrlTree } from '@angular/router';
import { forkJoin, map, Observable, of, shareReplay } from 'rxjs';
import { LeadsService } from './leads.service';

export interface OnboardingGateState {
  requiresOnboarding: boolean;
  leadCount: number;
  topicCount: number;
}

@Injectable({ providedIn: 'root' })
export class OnboardingGateService {
  private readonly leadsService = inject(LeadsService);
  private cachedState$?: Observable<OnboardingGateState>;
  private completedOverride = false;

  getState(forceRefresh = false): Observable<OnboardingGateState> {
    if (this.completedOverride) {
      return of({
        requiresOnboarding: false,
        leadCount: 0,
        topicCount: 1,
      });
    }

    if (!this.cachedState$ || forceRefresh) {
      this.cachedState$ = forkJoin({
        stats: this.leadsService.getStats(),
        topics: this.leadsService.getTopics(),
      }).pipe(
        map(({ stats, topics }) => ({
          requiresOnboarding: (stats?.total || 0) === 0 && topics.length === 0,
          leadCount: stats?.total || 0,
          topicCount: topics.length,
        })),
        shareReplay(1)
      );
    }

    return this.cachedState$;
  }

  markComplete(): void {
    this.completedOverride = true;
  }

  refresh(): void {
    this.completedOverride = false;
    this.cachedState$ = undefined;
  }
}

export const onboardingRequiredGuard: CanActivateFn = (): Observable<
  boolean | UrlTree
> => {
  const onboardingGate = inject(OnboardingGateService);
  const router = inject(Router);

  return onboardingGate.getState().pipe(
    map((state) =>
      state.requiresOnboarding ? router.createUrlTree(['/onboarding']) : true
    )
  );
};

export const onboardingRequiredMatchGuard: CanMatchFn = (): Observable<
  boolean | UrlTree
> => {
  const onboardingGate = inject(OnboardingGateService);
  const router = inject(Router);

  return onboardingGate.getState().pipe(
    map((state) =>
      state.requiresOnboarding ? router.createUrlTree(['/onboarding']) : true
    )
  );
};

export const onboardingPageGuard: CanActivateFn = (): Observable<
  boolean | UrlTree
> => {
  const onboardingGate = inject(OnboardingGateService);
  const router = inject(Router);

  return onboardingGate.getState().pipe(
    map((state) =>
      state.requiresOnboarding ? true : router.createUrlTree(['/'])
    )
  );
};

export const onboardingPageMatchGuard: CanMatchFn = (): Observable<
  boolean | UrlTree
> => {
  const onboardingGate = inject(OnboardingGateService);
  const router = inject(Router);

  return onboardingGate.getState().pipe(
    map((state) =>
      state.requiresOnboarding ? true : router.createUrlTree(['/'])
    )
  );
};
