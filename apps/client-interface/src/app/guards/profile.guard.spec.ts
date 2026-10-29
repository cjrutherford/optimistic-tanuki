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
    getDecodedTokenValue: jest.fn(() => ({ profileId: 'profile-1' })),
    restoreSession: jest.fn().mockResolvedValue(true),
  };

  const profileServiceMock = {
    getAllProfiles: jest.fn().mockResolvedValue(undefined),
    getCurrentUserProfiles: jest.fn<ProfileDto[], []>(() => []),
    selectProfile: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    profileServiceMock.getCurrentUserProfiles.mockReturnValue([]);
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

    profileServiceMock.getCurrentUserProfiles.mockReturnValue([
      { id: 'profile-1', profileName: 'User One' } as ProfileDto,
    ]);
    const result = await guard.canActivate();

    expect(result).toBe(true);
    expect(profileServiceMock.selectProfile).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'profile-1' })
    );
  });

  it('selects the profile identified by the restored cookie session when there is no saved selection', async () => {
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
    authStateServiceMock.getDecodedTokenValue.mockReturnValue({
      profileId: 'mine',
    });
    profileServiceMock.getCurrentUserProfiles.mockReturnValue([
      { id: 'mine' } as ProfileDto,
    ]);

    const result = await guard.canActivate();

    expect(result).toBe(true);
    expect(authStateServiceMock.restoreSession).toHaveBeenCalledTimes(1);
    expect(profileServiceMock.getAllProfiles).toHaveBeenCalledTimes(1);
  });
  it('routes an account without profiles to profile creation', async () => {
    expect(await guard.canActivate()).toBe(false);
    expect(routerMock.navigate).toHaveBeenCalledWith(
      ['/settings'],
      expect.anything()
    );
  });

  it('does not select a different profile when the session profile is missing from the fresh account list', async () => {
    authStateServiceMock.getDecodedTokenValue.mockReturnValue({
      profileId: 'missing-profile',
    });
    localStorage.setItem(
      'ot-client-selectedProfile',
      JSON.stringify({ id: 'stale' })
    );
    profileServiceMock.getCurrentUserProfiles.mockReturnValue([
      { id: 'mine' } as ProfileDto,
    ]);
    expect(await guard.canActivate()).toBe(false);
    expect(profileServiceMock.selectProfile).not.toHaveBeenCalled();
  });

  it('prefers the verified session profile over a stale stored selection and list order', async () => {
    localStorage.setItem(
      'ot-client-selectedProfile',
      JSON.stringify({ id: 'profile-1' })
    );
    authStateServiceMock.getDecodedTokenValue.mockReturnValue({
      profileId: 'profile-2',
    });
    const first = { id: 'profile-1' } as ProfileDto;
    const sessionProfile = { id: 'profile-2' } as ProfileDto;
    profileServiceMock.getCurrentUserProfiles.mockReturnValue([
      first,
      sessionProfile,
    ]);

    expect(await guard.canActivate()).toBe(true);
    expect(profileServiceMock.selectProfile).toHaveBeenCalledWith(
      sessionProfile
    );
    expect(profileServiceMock.selectProfile).not.toHaveBeenCalledWith(first);
  });

  it('does not fall back to the first profile when the verified session profile is unavailable', async () => {
    authStateServiceMock.getDecodedTokenValue.mockReturnValue({
      profileId: 'missing-profile',
    });
    const first = { id: 'profile-1' } as ProfileDto;
    profileServiceMock.getCurrentUserProfiles.mockReturnValue([first]);

    expect(await guard.canActivate()).toBe(false);
    expect(profileServiceMock.selectProfile).not.toHaveBeenCalled();
    expect(routerMock.navigate).toHaveBeenCalledWith(
      ['/settings'],
      expect.objectContaining({
        state: expect.objectContaining({ showProfileModal: false }),
      })
    );
  });
});
