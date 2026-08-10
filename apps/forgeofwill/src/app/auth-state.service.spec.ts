import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { AuthStateService, UserData } from './auth-state.service';
import { AuthenticationService } from './authentication.service';

describe('AuthStateService', () => {
  let service: AuthStateService;
  let authServiceMock: { login: jest.Mock; currentSession: jest.Mock };
  const mockToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJuYW1lIjoiVGVzdCBVc2VyIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const mockDecodedToken: UserData = {
    userId: '123',
    name: 'Test User',
    email: 'test@example.com',
    profileId: 'profile123',
  };
  const tokenKey = 'fow-client-authToken';
  const profilesKey = 'fow-client-profiles';

  describe('when in a browser environment', () => {
    beforeEach(() => {
      authServiceMock = {
        login: jest.fn().mockResolvedValue({ data: {} }),
        currentSession: jest.fn().mockResolvedValue({
          data: mockDecodedToken,
        }),
      };

      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [
          AuthStateService,
          { provide: AuthenticationService, useValue: authServiceMock },
          { provide: PLATFORM_ID, useValue: 'browser' },
        ],
      });

      // Mock localStorage
      let store: { [key: string]: string } = {};
      const mockLocalStorage = {
        getItem: (key: string): string | null => store[key] || null,
        setItem: (key: string, value: string) => (store[key] = value),
        removeItem: (key: string) => delete store[key],
        clear: () => (store = {}),
      };
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
      });
    });

    afterEach(() => {
      localStorage.clear();
    });

    it('should be created', () => {
      service = TestBed.inject(AuthStateService);
      expect(service).toBeTruthy();
    });

    it('should initialize from the HttpOnly-cookie session', async () => {
      service = TestBed.inject(AuthStateService);
      await service.restoreSession();

      expect(service.getToken()).toBeNull();
      expect(authServiceMock.currentSession).toHaveBeenCalled();
      service
        .isAuthenticated$()
        .subscribe((isAuth) => expect(isAuth).toBe(true));
      service
        .decodedToken$()
        .subscribe((decoded) => expect(decoded).toEqual(mockDecodedToken));
    });

    it('keeps a legacy callback token in memory without persisting it', () => {
      service = TestBed.inject(AuthStateService);
      service.setToken(mockToken);

      expect(service.getToken()).toBe(mockToken);
      service
        .isAuthenticated$()
        .subscribe((isAuth) => expect(isAuth).toBe(true));
      service
        .decodedToken$()
        .subscribe((decoded) => expect(decoded).toBeNull());
      expect(localStorage.getItem('fow-client-authToken')).toBeNull();
    });

    it('restores the cookie-backed session after a successful login', async () => {
      service = TestBed.inject(AuthStateService);
      const loginRequest = { email: 'test@example.com', password: 'password' };

      await service.login(loginRequest);

      expect(authServiceMock.login).toHaveBeenCalledWith(loginRequest);
      expect(authServiceMock.currentSession).toHaveBeenCalled();
      expect(service.isAuthenticated).toBe(true);
      expect(service.getDecodedTokenValue()).toEqual(mockDecodedToken);
    });

    it('allows a successful login restore after the initial cold restore resolves unauthenticated', async () => {
      authServiceMock.currentSession
        .mockRejectedValueOnce(new Error('No session on cold start'))
        .mockResolvedValueOnce({ data: mockDecodedToken });
      service = TestBed.inject(AuthStateService);

      await expect(service.waitForInitialSessionRestore()).resolves.toBe(false);
      expect(service.isAuthenticated).toBe(false);

      await service.login({ email: 'test@example.com', password: 'password' });

      expect(service.isAuthenticated).toBe(true);
      expect(service.getDecodedTokenValue()).toEqual(mockDecodedToken);
    });

    it('coalesces one guard-triggered cookie retry after the initial restore is unauthenticated', async () => {
      authServiceMock.currentSession
        .mockRejectedValueOnce(new Error('No session on cold start'))
        .mockResolvedValue({ data: mockDecodedToken });
      service = TestBed.inject(AuthStateService);

      await expect(service.waitForInitialSessionRestore()).resolves.toBe(false);
      const firstRetry = service.restoreSessionAfterInitialFailure();
      const secondRetry = service.restoreSessionAfterInitialFailure();

      await expect(firstRetry).resolves.toBe(true);
      await expect(secondRetry).resolves.toBe(true);
      expect(authServiceMock.currentSession).toHaveBeenCalledTimes(2);
    });

    it('should clear token and update subjects on logout', () => {
      localStorage.setItem(tokenKey, mockToken);
      service = TestBed.inject(AuthStateService);
      const removeItemSpy = jest.spyOn(localStorage, 'removeItem');

      service.logout();

      expect(service.getToken()).toBeNull();
      service
        .isAuthenticated$()
        .subscribe((isAuth) => expect(isAuth).toBe(false));
      service
        .decodedToken$()
        .subscribe((decoded) => expect(decoded).toBeNull());
      expect(removeItemSpy).toHaveBeenCalledWith(tokenKey);
    });

    it('should persist and retrieve profiles', () => {
      service = TestBed.inject(AuthStateService);
      const profiles: any[] = [{ id: 'p1', profileName: 'P1' }];
      service.persistProfiles(profiles);
      expect(service.getPersistedProfiles()).toEqual(profiles);

      service.persistProfiles(null);
      expect(service.getPersistedProfiles()).toBeNull();
    });

    it('should persist and retrieve selected profile', () => {
      service = TestBed.inject(AuthStateService);
      const profile: any = { id: 'p1', profileName: 'P1' };
      service.persistSelectedProfile(profile);
      expect(service.getPersistedSelectedProfile()).toEqual(profile);

      service.persistSelectedProfile(null);
      expect(service.getPersistedSelectedProfile()).toBeNull();
    });

    it('should return decoded token value', () => {
      service = TestBed.inject(AuthStateService);
      service.setToken(mockToken);
      expect(service.getDecodedTokenValue()).toBeNull();
    });

    it('should expose the user returned by session restoration', async () => {
      service = TestBed.inject(AuthStateService);
      await service.restoreSession();
      expect(service.getDecodedTokenValue()).toEqual(mockDecodedToken);
    });

    it('keeps a newer successful restore when the initial restore finishes later', async () => {
      let completeInitialRestore!: (response: { data: UserData }) => void;
      const initialRestore = new Promise<{ data: UserData }>((resolve) => {
        completeInitialRestore = resolve;
      });
      const newerUser: UserData = {
        ...mockDecodedToken,
        userId: 'newer-user',
        email: 'newer@example.test',
      };
      authServiceMock.currentSession
        .mockImplementationOnce(() => initialRestore)
        .mockResolvedValueOnce({ data: newerUser });

      service = TestBed.inject(AuthStateService);
      await service.restoreSession();
      completeInitialRestore({ data: mockDecodedToken });
      await service.waitForInitialSessionRestore();

      expect(service.isAuthenticated).toBe(true);
      expect(service.getDecodedTokenValue()).toEqual(newerUser);
    });

    it('does not restore an old session after logout', async () => {
      let completeInitialRestore!: (response: { data: UserData }) => void;
      const initialRestore = new Promise<{ data: UserData }>((resolve) => {
        completeInitialRestore = resolve;
      });
      authServiceMock.currentSession.mockImplementationOnce(
        () => initialRestore
      );

      service = TestBed.inject(AuthStateService);
      service.logout();
      completeInitialRestore({ data: mockDecodedToken });
      await service.waitForInitialSessionRestore();

      expect(service.isAuthenticated).toBe(false);
      expect(service.getDecodedTokenValue()).toBeNull();
    });
  });

  describe('when not in a browser environment', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [
          AuthStateService,
          { provide: AuthenticationService, useValue: authServiceMock },
          { provide: PLATFORM_ID, useValue: 'server' },
        ],
      });

      service = TestBed.inject(AuthStateService);
    });

    it('should initialize with default values', () => {
      expect(service.getToken()).toBeNull();
      service
        .isAuthenticated$()
        .subscribe((isAuth) => expect(isAuth).toBe(false));
      service
        .decodedToken$()
        .subscribe((decoded) => expect(decoded).toBeNull());
    });

    it('should not set token', () => {
      service.setToken(mockToken);
      expect(service.getToken()).toBeNull();
    });

    it('should reject login promise', async () => {
      await expect(
        service.login({ email: 'test@example.com', password: 'password' })
      ).rejects.toEqual('Login is not available on this platform.');
    });

    it('logout should not throw error', () => {
      expect(() => service.logout()).not.toThrow();
    });

    it('should return default values for all methods on server', () => {
      expect(service.isAuthenticated).toBe(false);
      expect(service.getDecodedTokenValue()).toBeNull();
      expect(service.getPersistedProfiles()).toBeNull();
      expect(service.getPersistedSelectedProfile()).toBeNull();

      service.persistProfiles([]);
      service.persistSelectedProfile({} as any);
      expect(service.getPersistedProfiles()).toBeNull();
      expect(service.getPersistedSelectedProfile()).toBeNull();
    });

    it('should return empty observables on server', (done) => {
      service.isAuthenticated$().subscribe((val) => {
        expect(val).toBe(false);
        done();
      });
    });

    it('should return empty decodedToken observable on server', (done) => {
      service.decodedToken$().subscribe((val) => {
        expect(val).toBeNull();
        done();
      });
    });
  });
});
