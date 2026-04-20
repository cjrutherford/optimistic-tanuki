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
});
