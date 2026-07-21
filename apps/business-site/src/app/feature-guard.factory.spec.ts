import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { BusinessSiteConfigStore } from '@optimistic-tanuki/business-data-access';
import { firstValueFrom, of } from 'rxjs';
import { createFeatureGuard } from './feature-guard.factory';

describe('createFeatureGuard', () => {
  it('returns true when the selected feature is enabled', async () => {
    const guard = createFeatureGuard({
      isFeatureEnabled: (site) => site.features.booking.enabled,
      redirectTo: ['/'],
    });

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
      firstValueFrom(guard({} as never, {} as never) as never)
    );

    expect(result).toBe(true);
  });

  it('redirects to the configured target when the feature is disabled', async () => {
    const redirectTree = { redirectedTo: '/somewhere' };
    const createUrlTree = jest.fn().mockReturnValue(redirectTree);
    const guard = createFeatureGuard({
      isFeatureEnabled: (site) => site.features.booking.enabled,
      redirectTo: ['/somewhere'],
    });

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
      firstValueFrom(guard({} as never, {} as never) as never)
    );

    expect(createUrlTree).toHaveBeenCalledWith(['/somewhere']);
    expect(result).toBe(redirectTree);
  });

  it('does not read the route param when useRouteSlug is not set', async () => {
    const guard = createFeatureGuard({
      isFeatureEnabled: (site) => site.features.booking.enabled,
      redirectTo: ['/'],
    });
    const fetch = jest
      .fn()
      .mockReturnValue(of({ features: { booking: { enabled: true } } }));

    TestBed.configureTestingModule({
      providers: [
        { provide: BusinessSiteConfigStore, useValue: { fetch } },
        { provide: Router, useValue: { createUrlTree: jest.fn() } },
      ],
    });

    const route = {
      paramMap: { get: jest.fn() },
    } as unknown as ActivatedRouteSnapshot;

    await TestBed.runInInjectionContext(() =>
      firstValueFrom(guard(route, {} as never) as never)
    );

    expect(route.paramMap.get).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(false, undefined);
  });

  it('forwards the siteSlug route param to fetch when useRouteSlug is set', async () => {
    const guard = createFeatureGuard({
      isFeatureEnabled: (site) => site.features.booking.enabled,
      redirectTo: ['/'],
      useRouteSlug: true,
    });
    const fetch = jest
      .fn()
      .mockReturnValue(of({ features: { booking: { enabled: true } } }));

    TestBed.configureTestingModule({
      providers: [
        { provide: BusinessSiteConfigStore, useValue: { fetch } },
        { provide: Router, useValue: { createUrlTree: jest.fn() } },
      ],
    });

    const route = {
      paramMap: {
        get: (key: string) => (key === 'siteSlug' ? 'acme-plumbing' : null),
      },
    } as unknown as ActivatedRouteSnapshot;

    await TestBed.runInInjectionContext(() =>
      firstValueFrom(guard(route, {} as never) as never)
    );

    expect(fetch).toHaveBeenCalledWith(false, 'acme-plumbing');
  });
});
