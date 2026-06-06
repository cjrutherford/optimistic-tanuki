import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BusinessSiteConfigStore } from '@optimistic-tanuki/business-data-access';
import { firstValueFrom, of } from 'rxjs';
import { ownerFinanceFeatureGuard } from './owner-finance-feature.guard';

describe('ownerFinanceFeatureGuard', () => {
  it('allows owner finance when invoices are enabled', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            fetch: jest.fn().mockReturnValue(
              of({
                features: {
                  invoices: { enabled: true },
                },
              })
            ),
          },
        },
        {
          provide: Router,
          useValue: {
            createUrlTree: jest.fn(),
          },
        },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      firstValueFrom(
        ownerFinanceFeatureGuard({} as never, {} as never) as never
      )
    );

    expect(result).toBe(true);
  });

  it('redirects disabled owner finance to the owner dashboard', async () => {
    const ownerDashboardTree = { redirectedTo: '/owner/dashboard' };
    const createUrlTree = jest.fn().mockReturnValue(ownerDashboardTree);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            fetch: jest.fn().mockReturnValue(
              of({
                features: {
                  invoices: { enabled: false },
                },
              })
            ),
          },
        },
        {
          provide: Router,
          useValue: {
            createUrlTree,
          },
        },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      firstValueFrom(
        ownerFinanceFeatureGuard({} as never, {} as never) as never
      )
    );

    expect(createUrlTree).toHaveBeenCalledWith(['/owner/dashboard']);
    expect(result).toBe(ownerDashboardTree);
  });
});
