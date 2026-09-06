import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { BusinessAuthService } from '@optimistic-tanuki/business-data-access';

import { businessAuthGuard } from './trainer-auth.guard';

/**
 * The owner area's gate. Both branches matter: letting an unauthenticated
 * visitor through would expose the owner portal, and redirecting an
 * authenticated one would lock the owner out of their own site.
 */
describe('businessAuthGuard', () => {
  let isAuthenticated: jest.Mock;

  const run = () =>
    TestBed.runInInjectionContext(() =>
      businessAuthGuard({} as never, {} as never)
    );

  beforeEach(() => {
    isAuthenticated = jest.fn();

    TestBed.configureTestingModule({
      providers: [
        { provide: BusinessAuthService, useValue: { isAuthenticated } },
        {
          provide: Router,
          useValue: {
            createUrlTree: jest.fn((commands: string[]) => ({
              commands,
            })),
          },
        },
      ],
    });
  });

  it('lets an authenticated owner through', () => {
    isAuthenticated.mockReturnValue(true);

    expect(run()).toBe(true);
  });

  it('redirects an unauthenticated visitor to the owner login', () => {
    isAuthenticated.mockReturnValue(false);

    const result = run() as unknown as { commands: string[] };

    expect(result.commands).toEqual(['/owner/login']);
  });

  it('returns a redirect rather than simply refusing', () => {
    isAuthenticated.mockReturnValue(false);
    const router = TestBed.inject(Router);

    run();

    // A bare `false` would leave the visitor on a blank page instead of the
    // login form.
    expect(router.createUrlTree).toHaveBeenCalledWith(['/owner/login']);
  });
});
