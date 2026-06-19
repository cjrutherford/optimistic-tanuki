import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router } from '@angular/router';

import { BusinessAuthService } from '@optimistic-tanuki/business-data-access';

import { clientAuthGuard } from './client-auth.guard';

describe('clientAuthGuard', () => {
  it('redirects hosted client portal requests to the matching business login route', () => {
    const createUrlTree = jest.fn((commands) => commands);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: BusinessAuthService,
          useValue: {
            isClientAuthenticated: jest.fn(() => false),
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

    const route = {
      paramMap: {
        get: (key: string) =>
          key === 'siteSlug' ? 'steady-hand-contracting' : null,
      },
    } as unknown as ActivatedRouteSnapshot;

    const result = TestBed.runInInjectionContext(() => clientAuthGuard(route));

    expect(createUrlTree).toHaveBeenCalledWith([
      '/sites',
      'steady-hand-contracting',
      'client',
      'login',
    ]);
    expect(result).toEqual([
      '/sites',
      'steady-hand-contracting',
      'client',
      'login',
    ]);
  });
});
