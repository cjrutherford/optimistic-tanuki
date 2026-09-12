import { TestBed } from '@angular/core/testing';
import { Router, RouterStateSnapshot } from '@angular/router';
import { AuthStateService } from '../state/auth-state.service';
import { ReturnIntentService } from '../state/return-intent.service';
import { configuratorAuthGuard } from './configurator-auth.guard';

describe('configuratorAuthGuard', () => {
  it('sends an anonymous deep-link visitor to sign-in with the canonical return URL', () => {
    const router = { createUrlTree: jest.fn().mockReturnValue('login-tree') };
    const returnIntent = { remember: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthStateService, useValue: { isAuthenticated: false } },
        { provide: ReturnIntentService, useValue: returnIntent },
      ],
    });

    const result = TestBed.runInInjectionContext(() =>
      configuratorAuthGuard(
        {} as never,
        {
          url: '/workspaces/workspace-1/sites/north-star',
        } as RouterStateSnapshot
      )
    );

    expect(result).toBe('login-tree');
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login'], {
      queryParams: {
        returnUrl: '/workspaces/workspace-1/sites/north-star',
      },
    });
    expect(returnIntent.remember).toHaveBeenCalledWith(
      '/workspaces/workspace-1/sites/north-star'
    );
  });

  it.each([
    'https://evil.example/phish',
    '//evil.example/phish',
    '/workspaces/workspace-1/sites/north-star\nalert(1)',
    '/login',
    '/login?returnUrl=/workspaces/workspace-1/sites/north-star',
  ])('falls back to the configurator root for unsafe return URL %s', (url) => {
    const router = { createUrlTree: jest.fn().mockReturnValue('login-tree') };
    const returnIntent = { remember: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthStateService, useValue: { isAuthenticated: false } },
        { provide: ReturnIntentService, useValue: returnIntent },
      ],
    });

    TestBed.runInInjectionContext(() =>
      configuratorAuthGuard({} as never, { url } as RouterStateSnapshot)
    );

    expect(router.createUrlTree).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/' },
    });
  });
});
