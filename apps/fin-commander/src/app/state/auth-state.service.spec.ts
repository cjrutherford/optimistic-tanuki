import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { API_BASE_URL, ProfileDto } from '@optimistic-tanuki/ui-models';
import { AuthStateService } from './auth-state.service';
import { AuthenticationService } from '../authentication.service';

describe('AuthStateService', () => {
  const tokenKey = 'fin-commander-auth-authToken';
  const profilesKey = 'fin-commander-auth-profiles';
  const selectedProfileKey = 'fin-commander-auth-selectedProfile';

  const profile: ProfileDto = {
    id: 'profile-1',
    userId: 'user-1',
    profileName: 'Finance Profile',
    profilePic: '',
    coverPic: '',
    bio: '',
    location: '',
    occupation: '',
    interests: '',
    skills: '',
    created_at: new Date('2026-01-01'),
    appScope: 'finance',
  };

  const createToken = (payload: Record<string, unknown>) => {
    const header = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' })
    ).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${header}.${body}.signature`;
  };

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        AuthStateService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: API_BASE_URL, useValue: '/api' },
        {
          provide: AuthenticationService,
          useValue: {
            login: jest.fn(),
            setToken: jest.fn(),
          },
        },
        {
          provide: HttpClient,
          useValue: {
            post: jest.fn().mockReturnValue(of({})),
          },
        },
      ],
    });
  });

  it('restores unauthenticated state when no local auth storage exists', () => {
    const service = TestBed.inject(AuthStateService);

    expect(service.isAuthenticated).toBe(false);
    expect(service.getToken()).toBeNull();
    expect(service.getPersistedProfiles()).toBeNull();
    expect(service.getPersistedSelectedProfile()).toBeNull();
  });

  it('persists and restores token and selected profile state', () => {
    const token = createToken({
      userId: 'user-1',
      name: 'Captain Ledger',
      email: 'captain@example.com',
      profileId: profile.id,
    });

    localStorage.setItem(tokenKey, token);
    localStorage.setItem(profilesKey, JSON.stringify([profile]));
    localStorage.setItem(selectedProfileKey, JSON.stringify(profile));

    const service = TestBed.inject(AuthStateService);

    expect(service.isAuthenticated).toBe(true);
    expect(service.getToken()).toBe(token);
    expect(service.getPersistedProfiles()).toEqual([
      expect.objectContaining({
        id: profile.id,
        userId: profile.userId,
        profileName: profile.profileName,
        appScope: 'finance',
      }),
    ]);
    expect(service.getPersistedSelectedProfile()).toEqual(
      expect.objectContaining({
        id: profile.id,
        userId: profile.userId,
        profileName: profile.profileName,
        appScope: 'finance',
      })
    );
    expect(service.getDecodedTokenValue()).toMatchObject({
      userId: 'user-1',
      email: 'captain@example.com',
      profileId: profile.id,
    });
  });
});
