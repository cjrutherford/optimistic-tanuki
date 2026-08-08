import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { ProfileGuard } from './profile.guard';
import { AuthStateService } from '../state/auth-state.service';
import { ProfileService } from '../profile.service';
import { ProfileDto } from '@optimistic-tanuki/ui-models';

describe('ProfileGuard', () => {
  let guard: ProfileGuard;
  const authStateSubject = new BehaviorSubject(true);

  const routerMock = {
    navigate: jest.fn(),
  };

  const authStateServiceMock = {
    isAuthenticated$: authStateSubject.asObservable(),
    getPersistedSelectedProfile: jest.fn(() => {
      const persisted = localStorage.getItem('ot-client-selectedProfile');
      return persisted ? JSON.parse(persisted) : null;
    }),
    restoreSession: jest.fn().mockResolvedValue(true),
  };

  const profileServiceMock = {
    getAllProfiles: jest.fn().mockResolvedValue(undefined),
    getCurrentUserProfiles: jest.fn<ProfileDto[], []>(() => []),
    selectProfile: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    authStateSubject.next(true);
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        ProfileGuard,
        { provide: Router, useValue: routerMock },
        { provide: AuthStateService, useValue: authStateServiceMock },
        { provide: ProfileService, useValue: profileServiceMock },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    guard = TestBed.inject(ProfileGuard);
  });

  it('restores the selected profile from AuthStateService storage keys', async () => {
    localStorage.setItem(
      'ot-client-selectedProfile',
      JSON.stringify({ id: 'profile-1', profileName: 'User One' })
    );

    const result = await guard.canActivate();

    expect(result).toBe(true);
    expect(profileServiceMock.selectProfile).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'profile-1' })
    );
  });

  it('selects the first available profile when a restored cookie session has no saved selection', async () => {
    profileServiceMock.getCurrentUserProfiles.mockReturnValue([
      { id: 'profile-1', profileName: 'User One' } as ProfileDto,
    ]);

    const result = await guard.canActivate();

    expect(result).toBe(true);
    expect(profileServiceMock.selectProfile).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'profile-1' })
    );
  });

  it('restores a cookie session before loading profiles when the guard starts unauthenticated', async () => {
    authStateSubject.next(false);

    const result = await guard.canActivate();

    expect(result).toBe(true);
    expect(authStateServiceMock.restoreSession).toHaveBeenCalledTimes(1);
    expect(profileServiceMock.getAllProfiles).toHaveBeenCalledTimes(1);
  });
});
