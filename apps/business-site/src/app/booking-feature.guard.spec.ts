import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { BusinessSiteConfigStore } from '@optimistic-tanuki/business-data-access';
import { firstValueFrom, of } from 'rxjs';
import { bookingFeatureGuard } from './booking-feature.guard';

function routeWithSlug(siteSlug: string | null) {
  return {
    paramMap: { get: (key: string) => (key === 'siteSlug' ? siteSlug : null) },
  } as unknown as ActivatedRouteSnapshot;
}

describe('bookingFeatureGuard', () => {
  it('allows navigation when booking is enabled', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            fetch: jest
              .fn()
              .mockReturnValue(
                of({ features: { booking: { enabled: true } } })
              ),
          },
        },
        { provide: Router, useValue: { createUrlTree: jest.fn() } },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      firstValueFrom(
        bookingFeatureGuard(
          routeWithSlug('acme-plumbing'),
          {} as never
        ) as never
      )
    );

    expect(result).toBe(true);
  });

  it('redirects disabled booking to the site root', async () => {
    const homeTree = { redirectedTo: '/' };
    const createUrlTree = jest.fn().mockReturnValue(homeTree);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            fetch: jest
              .fn()
              .mockReturnValue(
                of({ features: { booking: { enabled: false } } })
              ),
          },
        },
        { provide: Router, useValue: { createUrlTree } },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      firstValueFrom(
        bookingFeatureGuard(
          routeWithSlug('acme-plumbing'),
          {} as never
        ) as never
      )
    );

    expect(createUrlTree).toHaveBeenCalledWith(['/']);
    expect(result).toBe(homeTree);
  });

  it('forwards the siteSlug route param to the site config fetch', async () => {
    const fetch = jest
      .fn()
      .mockReturnValue(of({ features: { booking: { enabled: true } } }));

    TestBed.configureTestingModule({
      providers: [
        { provide: BusinessSiteConfigStore, useValue: { fetch } },
        { provide: Router, useValue: { createUrlTree: jest.fn() } },
      ],
    });

    await TestBed.runInInjectionContext(() =>
      firstValueFrom(
        bookingFeatureGuard(
          routeWithSlug('steady-hand-contracting'),
          {} as never
        ) as never
      )
    );

    expect(fetch).toHaveBeenCalledWith(false, 'steady-hand-contracting');
  });
});
