import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
} from '@angular/router';

import { BusinessAuthService } from '@optimistic-tanuki/business-data-access';

import { businessAuthGuard } from './trainer-auth.guard';

describe('businessAuthGuard', () => {
  it('redirects owner deep links with their normalized return URL', () => {
    const createUrlTree = jest.fn((commands, extras) => ({ commands, extras }));

    TestBed.configureTestingModule({
      providers: [
        {
          provide: BusinessAuthService,
          useValue: { isAuthenticated: jest.fn(() => false) },
        },
        { provide: Router, useValue: { createUrlTree } },
      ],
    });

    const result = TestBed.runInInjectionContext(() =>
      businessAuthGuard(
        {
          paramMap: { get: () => null },
        } as unknown as ActivatedRouteSnapshot,
        { url: '/owner/requests?status=pending' } as RouterStateSnapshot
      )
    );

    expect(createUrlTree).toHaveBeenCalledWith(['/owner/login'], {
      queryParams: {
        returnUrl: '/owner/requests?status=pending',
      },
    });
    expect(result).toEqual({
      commands: ['/owner/login'],
      extras: {
        queryParams: {
          returnUrl: '/owner/requests?status=pending',
        },
      },
    });
  });

  it('keeps hosted owner deep links within the matching business login flow', () => {
    const createUrlTree = jest.fn((commands, extras) => ({ commands, extras }));

    TestBed.configureTestingModule({
      providers: [
        {
          provide: BusinessAuthService,
          useValue: { isAuthenticated: jest.fn(() => false) },
        },
        { provide: Router, useValue: { createUrlTree } },
      ],
    });

    TestBed.runInInjectionContext(() =>
      businessAuthGuard(
        {
          paramMap: {
            get: (key: string) =>
              key === 'siteSlug' ? 'steady-hand-contracting' : null,
          },
        } as unknown as ActivatedRouteSnapshot,
        {
          url: '/sites/steady-hand-contracting/owner/availability',
        } as RouterStateSnapshot
      )
    );

    expect(createUrlTree).toHaveBeenCalledWith(
      ['/sites', 'steady-hand-contracting', 'owner', 'login'],
      {
        queryParams: {
          returnUrl: '/sites/steady-hand-contracting/owner/availability',
        },
      }
    );
  });

  it.each([
    'https://evil.example/owner/dashboard',
    '//evil.example/owner/dashboard',
    '/owner/login',
    '/owner/register',
    '/owner/dashboard\nalert(1)',
  ])('uses the owner dashboard fallback for unsafe return URL %s', (url) => {
    const createUrlTree = jest.fn((commands, extras) => ({ commands, extras }));

    TestBed.configureTestingModule({
      providers: [
        {
          provide: BusinessAuthService,
          useValue: { isAuthenticated: jest.fn(() => false) },
        },
        { provide: Router, useValue: { createUrlTree } },
      ],
    });

    TestBed.runInInjectionContext(() =>
      businessAuthGuard(
        {
          paramMap: { get: () => null },
        } as unknown as ActivatedRouteSnapshot,
        { url } as RouterStateSnapshot
      )
    );

    expect(createUrlTree).toHaveBeenCalledWith(['/owner/login'], {
      queryParams: { returnUrl: '/owner/dashboard' },
    });
  });

  it('allows an authenticated owner through without creating a login redirect', () => {
    const createUrlTree = jest.fn();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: BusinessAuthService,
          useValue: { isAuthenticated: jest.fn(() => true) },
        },
        { provide: Router, useValue: { createUrlTree } },
      ],
    });

    const result = TestBed.runInInjectionContext(() =>
      businessAuthGuard(
        {} as ActivatedRouteSnapshot,
        { url: '/owner/dashboard' } as RouterStateSnapshot
      )
    );

    expect(result).toBe(true);
    expect(createUrlTree).not.toHaveBeenCalled();
  });
});
