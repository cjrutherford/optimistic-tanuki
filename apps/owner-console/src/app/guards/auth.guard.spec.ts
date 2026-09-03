import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
} from '@angular/router';

import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  const isAuthenticated = jest.fn();
  const navigate = jest.fn();

  const runGuard = () => {
    const injector = TestBed.inject(Injector);
    return runInInjectionContext(injector, () =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );
  };

  beforeEach(() => {
    isAuthenticated.mockReset();
    navigate.mockReset();

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isAuthenticated } },
        { provide: Router, useValue: { navigate } },
      ],
    });
  });

  it('allows navigation for an authenticated operator', () => {
    isAuthenticated.mockReturnValue(true);

    expect(runGuard()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('blocks navigation and redirects anonymous visitors to login', () => {
    isAuthenticated.mockReturnValue(false);

    expect(runGuard()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
