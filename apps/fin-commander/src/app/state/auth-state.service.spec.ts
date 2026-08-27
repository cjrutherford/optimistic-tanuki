import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { API_BASE_URL, ProfileDto } from '@optimistic-tanuki/ui-models';
import { AuthStateService } from './auth-state.service';
import { AuthenticationService } from '../authentication.service';

describe('AuthStateService', () => {
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
            currentSession: jest.fn(),
            setToken: jest.fn(),
          },
        },
        {
          provide: HttpClient,
          useValue: {
            post: jest.fn().mockReturnValue(of({})),
            get: jest.fn().mockReturnValue(of({ data: null })),
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

  it('restores identity from the cookie-backed session without persisting a token', async () => {
    localStorage.setItem(profilesKey, JSON.stringify([profile]));
    localStorage.setItem(selectedProfileKey, JSON.stringify(profile));

    const authentication = TestBed.inject(AuthenticationService) as unknown as {
      currentSession: jest.Mock;
    };
    authentication.currentSession.mockResolvedValue({
      data: {
        userId: 'user-1',
        name: 'Captain Ledger',
        email: 'captain@example.com',
        profileId: profile.id,
      },
    });
    const service = TestBed.inject(AuthStateService);
    await service.restoreSession();

    expect(service.isAuthenticated).toBe(true);
    expect(service.getToken()).toBeNull();
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

  it('keeps a successful post-login restoration when an older session probe fails', async () => {
    let rejectStartupProbe: (reason?: unknown) => void = () => undefined;
    const authentication = TestBed.inject(AuthenticationService) as unknown as {
      currentSession: jest.Mock;
    };
    authentication.currentSession
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectStartupProbe = reject;
          })
      )
      .mockResolvedValueOnce({
        data: {
          userId: 'user-1',
          name: 'Captain Ledger',
          email: 'captain@example.com',
          profileId: profile.id,
        },
      });

    const service = TestBed.inject(AuthStateService);

    await expect(
      (
        service as unknown as {
          restoreSession: (options: { force: boolean }) => Promise<boolean>;
        }
      ).restoreSession({ force: true })
    ).resolves.toBe(true);
    rejectStartupProbe(new Error('anonymous session expired'));
    await Promise.resolve();
    await Promise.resolve();

    expect(service.isAuthenticated).toBe(true);
    expect(service.getDecodedTokenValue()).toMatchObject({
      userId: 'user-1',
      email: 'captain@example.com',
    });
  });
});
