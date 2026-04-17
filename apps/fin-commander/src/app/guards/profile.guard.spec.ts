import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ProfileGuard } from './profile.guard';
import { AuthStateService } from '../state/auth-state.service';
import { ProfileService } from '../profile.service';

describe('ProfileGuard', () => {
  it('redirects authenticated users without a selected profile to login', async () => {
    const navigate = jest.fn().mockResolvedValue(true);

    TestBed.configureTestingModule({
      providers: [
        ProfileGuard,
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
              subscribe: (cb: (value: boolean) => void) => cb(true),
            },
            getPersistedSelectedProfile: jest.fn().mockReturnValue(null),
          },
        },
        {
          provide: ProfileService,
          useValue: {
            getAllProfiles: jest.fn().mockResolvedValue(undefined),
            getCurrentUserProfile: jest.fn().mockReturnValue(null),
          },
        },
      ],
    });

    const guard = TestBed.inject(ProfileGuard);

    await expect(guard.canActivate()).resolves.toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
