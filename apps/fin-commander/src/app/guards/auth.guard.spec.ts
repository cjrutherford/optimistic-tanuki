import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthGuard } from './auth.guard';
import { AuthStateService } from '../state/auth-state.service';
import { ProfileService } from '../profile.service';

describe('AuthGuard', () => {
  it('redirects unauthenticated users to login', async () => {
    const navigate = jest.fn().mockResolvedValue(true);

    TestBed.configureTestingModule({
      providers: [
        AuthGuard,
        {
          provide: Router,
          useValue: {
            navigate,
          },
        },
        {
          provide: AuthStateService,
          useValue: {
            isAuthenticated: false,
            restoreSession: jest.fn().mockResolvedValue(false),
            isAuthenticated$: {
              subscribe: (cb: (value: boolean) => void) => cb(false),
            },
          },
        },
        {
          provide: ProfileService,
          useValue: {},
        },
      ],
    });

    const guard = TestBed.inject(AuthGuard);

    await expect(guard.canActivate()).resolves.toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('allows a protected route when cookie session restoration succeeds', async () => {
    const navigate = jest.fn().mockResolvedValue(true);
    const restoreSession = jest.fn().mockResolvedValue(true);

    TestBed.configureTestingModule({
      providers: [
        AuthGuard,
        { provide: Router, useValue: { navigate } },
        {
          provide: AuthStateService,
          useValue: {
            isAuthenticated: false,
            restoreSession,
            isAuthenticated$: {
              subscribe: (cb: (value: boolean) => void) => cb(false),
            },
          },
        },
        { provide: ProfileService, useValue: {} },
      ],
    });

    await expect(TestBed.inject(AuthGuard).canActivate()).resolves.toBe(true);
    expect(restoreSession).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });
});
