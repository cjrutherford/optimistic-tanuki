import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
} from '@angular/router';

import { BusinessAuthService } from '@optimistic-tanuki/business-data-access';

import { clientAuthGuard } from './client-auth.guard';

describe('clientAuthGuard', () => {
  it('redirects hosted client portal requests with their normalized return URL', () => {
    const createUrlTree = jest.fn((commands, extras) => ({
      commands,
      extras,
    }));

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

    const result = TestBed.runInInjectionContext(() =>
      clientAuthGuard(route, {
        url: '/sites/steady-hand-contracting/client/routines?view=week',
      } as RouterStateSnapshot)
    );

    expect(createUrlTree).toHaveBeenCalledWith(
      ['/sites', 'steady-hand-contracting', 'client', 'login'],
      {
        queryParams: {
          returnUrl: '/sites/steady-hand-contracting/client/routines?view=week',
        },
      }
    );
    expect(result).toEqual({
      commands: ['/sites', 'steady-hand-contracting', 'client', 'login'],
      extras: {
        queryParams: {
          returnUrl: '/sites/steady-hand-contracting/client/routines?view=week',
        },
      },
    });
  });

  it.each([
    'https://evil.example/client/dashboard',
    '//evil.example/client/dashboard',
    '/sites/steady-hand-contracting/client/login',
    '/sites/steady-hand-contracting/client/register',
    '/sites/steady-hand-contracting/client/dashboard\nalert(1)',
  ])(
    'uses the hosted client dashboard fallback for unsafe return URL %s',
    (url) => {
      const createUrlTree = jest.fn((commands, extras) => ({
        commands,
        extras,
      }));

      TestBed.configureTestingModule({
        providers: [
          {
            provide: BusinessAuthService,
            useValue: { isClientAuthenticated: jest.fn(() => false) },
          },
          { provide: Router, useValue: { createUrlTree } },
        ],
      });

      const route = {
        paramMap: {
          get: (key: string) =>
            key === 'siteSlug' ? 'steady-hand-contracting' : null,
        },
      } as unknown as ActivatedRouteSnapshot;

      TestBed.runInInjectionContext(() =>
        clientAuthGuard(route, { url } as RouterStateSnapshot)
      );

      expect(createUrlTree).toHaveBeenCalledWith(
        ['/sites', 'steady-hand-contracting', 'client', 'login'],
        {
          queryParams: {
            returnUrl: '/sites/steady-hand-contracting/client/dashboard',
          },
        }
      );
    }
  );

  it('allows an authenticated client through without creating a login redirect', () => {
    const createUrlTree = jest.fn();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: BusinessAuthService,
          useValue: { isClientAuthenticated: jest.fn(() => true) },
        },
        { provide: Router, useValue: { createUrlTree } },
      ],
    });

    const result = TestBed.runInInjectionContext(() =>
      clientAuthGuard(
        {} as ActivatedRouteSnapshot,
        { url: '/client/dashboard' } as RouterStateSnapshot
      )
    );

    expect(result).toBe(true);
    expect(createUrlTree).not.toHaveBeenCalled();
  });
});
