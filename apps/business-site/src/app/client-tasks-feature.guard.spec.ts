import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BusinessSiteConfigStore } from '@optimistic-tanuki/business-data-access';
import { firstValueFrom, of } from 'rxjs';
import { clientTasksFeatureGuard } from './client-tasks-feature.guard';

describe('clientTasksFeatureGuard', () => {
  it('allows navigation when client tasks are enabled', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            fetch: jest
              .fn()
              .mockReturnValue(
                of({ features: { clientTasks: { enabled: true } } })
              ),
          },
        },
        { provide: Router, useValue: { createUrlTree: jest.fn() } },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      firstValueFrom(clientTasksFeatureGuard({} as never, {} as never) as never)
    );

    expect(result).toBe(true);
  });

  it('redirects disabled client tasks to the client dashboard', async () => {
    const dashboardTree = { redirectedTo: '/client/dashboard' };
    const createUrlTree = jest.fn().mockReturnValue(dashboardTree);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            fetch: jest
              .fn()
              .mockReturnValue(
                of({ features: { clientTasks: { enabled: false } } })
              ),
          },
        },
        { provide: Router, useValue: { createUrlTree } },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      firstValueFrom(clientTasksFeatureGuard({} as never, {} as never) as never)
    );

    expect(createUrlTree).toHaveBeenCalledWith(['/client/dashboard']);
    expect(result).toBe(dashboardTree);
  });
});
