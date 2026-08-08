import { AuthGuard } from './auth.guard';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthStateService } from '../state/auth-state.service';
import { ProfileService } from '../profile.service';

describe('AuthGuard', () => {
  it('restores a cookie session before redirecting an apparently logged-out browser', async () => {
    const router = { navigate: jest.fn() } as any;
    const authStateService = {
      isAuthenticated$: {
        subscribe: (listener: (value: boolean) => void) => {
          listener(false);
          return { unsubscribe: jest.fn() };
        },
      },
      restoreSession: jest.fn().mockResolvedValue(true),
    } as any;
    const profileService = {} as any;

    TestBed.configureTestingModule({
      providers: [
        AuthGuard,
        { provide: Router, useValue: router },
        { provide: AuthStateService, useValue: authStateService },
        { provide: ProfileService, useValue: profileService },
      ],
    });

    const guard = TestBed.inject(AuthGuard);

    await expect(guard.canActivate()).resolves.toBe(true);
    expect(authStateService.restoreSession).toHaveBeenCalledTimes(1);
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
