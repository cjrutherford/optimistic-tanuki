import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of, throwError } from 'rxjs';
import { API_BASE_URL, ProfileDto } from '@optimistic-tanuki/ui-models';
import { AuthStateService } from './auth-state.service';
import { AuthenticationService } from '../authentication.service';

interface AuthenticationStub {
  login: jest.Mock;
  currentSession: jest.Mock;
  setToken: jest.Mock;
}

interface HttpStub {
  post: jest.Mock;
  get: jest.Mock;
}

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

const session = {
  userId: 'user-1',
  name: 'Captain Ledger',
  email: 'captain@example.com',
  profileId: profile.id,
};

describe('AuthStateService in the browser', () => {
  let authentication: AuthenticationStub;
  let http: HttpStub;

  beforeEach(() => {
    localStorage.clear();

    authentication = {
      login: jest.fn(),
      currentSession: jest.fn().mockRejectedValue(new Error('no session')),
      setToken: jest.fn(),
    };
    http = {
      post: jest.fn().mockReturnValue(of({})),
      get: jest.fn().mockReturnValue(of({ data: null })),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthStateService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: API_BASE_URL, useValue: '/api' },
        { provide: AuthenticationService, useValue: authentication },
        { provide: HttpClient, useValue: http },
      ],
    });
  });

  it('seeds the current profile stream from local storage on construction', async () => {
    localStorage.setItem(selectedProfileKey, JSON.stringify(profile));

    const service = TestBed.inject(AuthStateService);

    await expect(firstValueFrom(service.currentProfile$)).resolves.toEqual(
      expect.objectContaining({ id: profile.id, appScope: 'finance' })
    );
  });

  describe('setToken', () => {
    it('publishes the token, authenticates the session and forwards it to the auth service', () => {
      const service = TestBed.inject(AuthStateService);

      service.setToken('header.payload.signature');

      expect(service.getToken()).toBe('header.payload.signature');
      expect(service.isAuthenticated).toBe(true);
      // The identity is only known once the session probe answers, so the
      // decoded value is deliberately cleared when a raw token arrives.
      expect(service.getDecodedTokenValue()).toBeNull();
      expect(authentication.setToken).toHaveBeenCalledWith(
        'header.payload.signature'
      );
    });
  });

  describe('login', () => {
    it('stores the issued token and adopts the identity from the cookie session', async () => {
      authentication.login.mockResolvedValue({
        data: { newToken: 'header.payload.signature' },
      });
      authentication.currentSession.mockResolvedValue({ data: session });
      const service = TestBed.inject(AuthStateService);

      const response = await service.login({
        email: 'captain@example.com',
        password: 'secret',
      } as never);

      expect(response).toEqual({
        data: { newToken: 'header.payload.signature' },
      });
      expect(authentication.login).toHaveBeenCalledWith({
        email: 'captain@example.com',
        password: 'secret',
      });
      expect(authentication.setToken).toHaveBeenCalledWith(
        'header.payload.signature'
      );
      expect(service.isAuthenticated).toBe(true);
      expect(service.getDecodedTokenValue()).toEqual(session);
      // The cookie session is authoritative, so the bearer token is dropped.
      expect(service.getToken()).toBeNull();
    });

    it('skips the token handover when the server issues no new token', async () => {
      authentication.login.mockResolvedValue({ data: {} });
      authentication.currentSession.mockResolvedValue({ data: session });
      const service = TestBed.inject(AuthStateService);

      await service.login({
        email: 'captain@example.com',
        password: 'secret',
      } as never);

      expect(authentication.setToken).not.toHaveBeenCalled();
      expect(service.isAuthenticated).toBe(true);
    });

    it('propagates a rejected sign-in and stays unauthenticated', async () => {
      authentication.login.mockRejectedValue(new Error('Invalid credentials'));
      const service = TestBed.inject(AuthStateService);

      await expect(
        service.login({
          email: 'captain@example.com',
          password: 'wrong',
        } as never)
      ).rejects.toThrow('Invalid credentials');

      expect(service.isAuthenticated).toBe(false);
      expect(service.getDecodedTokenValue()).toBeNull();
    });
  });

  describe('logout', () => {
    it('revokes the held token server side and clears every local trace of the session', async () => {
      authentication.currentSession.mockResolvedValue({ data: session });
      const service = TestBed.inject(AuthStateService);
      await service.restoreSession({ force: true });
      service.setToken('header.payload.signature');
      service.persistProfiles([profile]);
      service.persistSelectedProfile(profile);

      service.logout();

      expect(http.post).toHaveBeenCalledWith(
        '/api/authentication/logout',
        { token: 'header.payload.signature' },
        { withCredentials: true }
      );
      expect(localStorage.getItem(profilesKey)).toBeNull();
      expect(localStorage.getItem(selectedProfileKey)).toBeNull();
      expect(service.getToken()).toBeNull();
      expect(service.getDecodedTokenValue()).toBeNull();
      expect(service.isAuthenticated).toBe(false);
      await expect(firstValueFrom(service.currentProfile$)).resolves.toBeNull();
    });

    it('sends an empty body when no bearer token is held', () => {
      const service = TestBed.inject(AuthStateService);

      service.logout();

      expect(http.post).toHaveBeenCalledWith(
        '/api/authentication/logout',
        {},
        { withCredentials: true }
      );
    });

    it('still clears local state when the revocation request fails', () => {
      http.post.mockReturnValue(throwError(() => new Error('offline')));
      const service = TestBed.inject(AuthStateService);
      service.setToken('header.payload.signature');
      service.persistProfiles([profile]);

      expect(() => service.logout()).not.toThrow();

      expect(localStorage.getItem(profilesKey)).toBeNull();
      expect(service.isAuthenticated).toBe(false);
    });
  });

  describe('persistence', () => {
    it('round-trips the profile list through local storage', () => {
      const service = TestBed.inject(AuthStateService);

      service.persistProfiles([profile]);

      expect(JSON.parse(localStorage.getItem(profilesKey) as string)).toEqual([
        expect.objectContaining({ id: profile.id, userId: profile.userId }),
      ]);
      expect(service.getPersistedProfiles()).toEqual([
        expect.objectContaining({ id: profile.id, appScope: 'finance' }),
      ]);
    });

    it('drops the stored profile list when asked to persist nothing', () => {
      const service = TestBed.inject(AuthStateService);
      service.persistProfiles([profile]);

      service.persistProfiles(null);

      expect(localStorage.getItem(profilesKey)).toBeNull();
      expect(service.getPersistedProfiles()).toBeNull();
    });

    it('publishes and stores the selected profile', async () => {
      const service = TestBed.inject(AuthStateService);

      service.persistSelectedProfile(profile);

      expect(
        JSON.parse(localStorage.getItem(selectedProfileKey) as string)
      ).toEqual(expect.objectContaining({ id: profile.id }));
      expect(service.getPersistedSelectedProfile()).toEqual(
        expect.objectContaining({ id: profile.id })
      );
      await expect(firstValueFrom(service.currentProfile$)).resolves.toEqual(
        expect.objectContaining({ id: profile.id })
      );
    });

    it('clears the selected profile and notifies subscribers', async () => {
      const service = TestBed.inject(AuthStateService);
      service.persistSelectedProfile(profile);

      service.persistSelectedProfile(null);

      expect(localStorage.getItem(selectedProfileKey)).toBeNull();
      expect(service.getPersistedSelectedProfile()).toBeNull();
      await expect(firstValueFrom(service.currentProfile$)).resolves.toBeNull();
    });
  });
});

describe('AuthStateService on the server', () => {
  let authentication: AuthenticationStub;
  let http: HttpStub;
  let service: AuthStateService;

  beforeEach(() => {
    localStorage.clear();

    authentication = {
      login: jest.fn(),
      currentSession: jest.fn(),
      setToken: jest.fn(),
    };
    http = {
      post: jest.fn().mockReturnValue(of({})),
      get: jest.fn().mockReturnValue(of({ data: null })),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthStateService,
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: API_BASE_URL, useValue: '/api' },
        { provide: AuthenticationService, useValue: authentication },
        { provide: HttpClient, useValue: http },
      ],
    });

    service = TestBed.inject(AuthStateService);
  });

  it('never probes for a session while rendering', () => {
    expect(authentication.currentSession).not.toHaveBeenCalled();
    expect(service.isAuthenticated).toBe(false);
    expect(service.getToken()).toBeNull();
    expect(service.getDecodedTokenValue()).toBeNull();
  });

  it('resolves session restoration as unauthenticated without any work', async () => {
    await expect(service.restoreSession({ force: true })).resolves.toBe(false);
    expect(authentication.currentSession).not.toHaveBeenCalled();
  });

  it('refuses to sign in', async () => {
    await expect(
      service.login({
        email: 'captain@example.com',
        password: 'secret',
      } as never)
    ).rejects.toThrow('Login is not available on this platform.');
    expect(authentication.login).not.toHaveBeenCalled();
  });

  it('ignores token handling and logout', () => {
    service.setToken('header.payload.signature');
    service.logout();

    expect(authentication.setToken).not.toHaveBeenCalled();
    expect(http.post).not.toHaveBeenCalled();
    expect(service.getToken()).toBeNull();
    expect(service.isAuthenticated).toBe(false);
  });

  it('neither writes nor reads browser storage', () => {
    // Local storage exists under jsdom, so the guard is the only thing keeping
    // server-side renders from leaking one visitor's profiles into the next.
    service.persistProfiles([profile]);
    service.persistSelectedProfile(profile);

    expect(localStorage.getItem(profilesKey)).toBeNull();
    expect(localStorage.getItem(selectedProfileKey)).toBeNull();

    localStorage.setItem(profilesKey, JSON.stringify([profile]));
    localStorage.setItem(selectedProfileKey, JSON.stringify(profile));

    expect(service.getPersistedProfiles()).toBeNull();
    expect(service.getPersistedSelectedProfile()).toBeNull();
  });
});
