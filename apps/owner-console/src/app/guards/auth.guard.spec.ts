import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  const authService = {
    isAuthenticated: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [{ provide: AuthService, useValue: authService }],
    });
  });

  function canActivate(url: string): unknown {
    return TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot)
    );
  }

  function serialize(result: unknown): string {
    expect(result).toBeInstanceOf(UrlTree);
    return TestBed.inject(Router).serializeUrl(result as UrlTree);
  }

  it('allows an authenticated owner to continue without redirecting', () => {
    authService.isAuthenticated.mockReturnValue(true);

    expect(canActivate('/dashboard/operations')).toBe(true);
  });

  it('returns a login UrlTree with the normalized protected deep link', () => {
    authService.isAuthenticated.mockReturnValue(false);

    const result = canActivate('/dashboard/operations?tab=oauth#providers');

    expect(serialize(result)).toBe(
      '/login?returnUrl=%2Fdashboard%2Foperations%3Ftab%3Doauth%23providers'
    );
  });

  it.each([
    'https://evil.example/phishing',
    '//evil.example/phishing',
    '/dashboard/%0A/operations',
    '/login',
    '/auth/login',
  ])('falls back to the dashboard for unsafe return target %s', (url) => {
    authService.isAuthenticated.mockReturnValue(false);

    const result = canActivate(url);

    expect(serialize(result)).toBe('/login?returnUrl=%2Fdashboard');
  });
});
