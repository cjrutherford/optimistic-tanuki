import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { ProfileGuard } from './profile.guard';
import { AuthStateService } from '../state/auth-state.service';
import { ProfileService } from '../profile.service';

describe('ProfileGuard', () => {
  let guard: ProfileGuard;

  const routerMock = {
    navigate: jest.fn(),
  };

  const authStateServiceMock = {
    isAuthenticated$: of(true),
    getPersistedSelectedProfile: jest.fn(() => {
      const persisted = localStorage.getItem('ot-client-selectedProfile');
      return persisted ? JSON.parse(persisted) : null;
    }),
  };

  const profileServiceMock = {
    getAllProfiles: jest.fn().mockResolvedValue(undefined),
    selectProfile: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
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
});
