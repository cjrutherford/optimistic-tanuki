import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BusinessSiteConfigStore } from '@optimistic-tanuki/business-data-access';
import { firstValueFrom, of } from 'rxjs';
import { invoicesFeatureGuard } from './invoices-feature.guard';

describe('invoicesFeatureGuard', () => {
  it('allows client billing when invoices are enabled', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            fetch: jest
              .fn()
              .mockReturnValue(
                of({ features: { invoices: { enabled: true } } })
              ),
          },
        },
        { provide: Router, useValue: { createUrlTree: jest.fn() } },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      firstValueFrom(invoicesFeatureGuard({} as never, {} as never) as never)
    );

    expect(result).toBe(true);
  });

  it('redirects disabled client billing to the client dashboard', async () => {
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
                of({ features: { invoices: { enabled: false } } })
              ),
          },
        },
        { provide: Router, useValue: { createUrlTree } },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      firstValueFrom(invoicesFeatureGuard({} as never, {} as never) as never)
    );

    expect(createUrlTree).toHaveBeenCalledWith(['/client/dashboard']);
    expect(result).toBe(dashboardTree);
  });
});
