import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BusinessSiteConfigStore } from '@optimistic-tanuki/business-data-access';
import { firstValueFrom, of } from 'rxjs';
import { clientPortalFeatureGuard } from './client-portal-feature.guard';

describe('clientPortalFeatureGuard', () => {
  it('allows navigation when the client portal is enabled', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            fetch: jest
              .fn()
              .mockReturnValue(
                of({ features: { clientPortal: { enabled: true } } })
              ),
          },
        },
        { provide: Router, useValue: { createUrlTree: jest.fn() } },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      firstValueFrom(
        clientPortalFeatureGuard({} as never, {} as never) as never
      )
    );

    expect(result).toBe(true);
  });

  it('redirects disabled client portal to the site root', async () => {
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
                of({ features: { clientPortal: { enabled: false } } })
              ),
          },
        },
        { provide: Router, useValue: { createUrlTree } },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      firstValueFrom(
        clientPortalFeatureGuard({} as never, {} as never) as never
      )
    );

    expect(createUrlTree).toHaveBeenCalledWith(['/']);
    expect(result).toBe(homeTree);
  });
});
