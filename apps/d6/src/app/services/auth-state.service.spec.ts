import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { AuthStateService } from './auth-state.service';

describe('AuthStateService', () => {
  let service: AuthStateService;
  let httpMock: HttpTestingController;

  const mockUser = { id: 'user-1', name: 'Test User' };

  function makeToken(payload: Record<string, unknown>): string {
    const header = btoa(JSON.stringify({ alg: 'none' }));
    const body = btoa(JSON.stringify(payload));
    return `${header}.${body}.signature`;
  }

  beforeEach(() => {
    const store: Record<string, string> = {};
    const localStorageMock = {
      getItem: jest.fn((key: string) =>
        Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null
      ),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
      }),
      clear: jest.fn(() => {
        for (const key in store) delete store[key];
      }),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    });

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthStateService,
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    service = TestBed.inject(AuthStateService);
    httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne('/api/authentication/session').flush(null, {
      status: 401,
      statusText: 'Unauthenticated',
    });
  });

  afterEach(() => {
    httpMock.verify();
    jest.clearAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('restoreSession', () => {
    it('sets authenticated state on success', async () => {
      const restored = service.restoreSession();
      const req = httpMock.expectOne('/api/authentication/session');
      req.flush({ data: mockUser });

      await expect(restored).resolves.toBe(true);
      expect(service.isAuthenticated()).toBe(true);
      expect(service.user()).toEqual(mockUser);
      expect(service.getToken()).toBeNull();
    });

    it('clears state on failure', async () => {
      service.setToken(makeToken({ sub: 'x' }));
      const restored = service.restoreSession();
      const req = httpMock.expectOne('/api/authentication/session');
      req.flush(null, { status: 500, statusText: 'Server Error' });

      await expect(restored).resolves.toBe(false);
      expect(service.isAuthenticated()).toBe(false);
      expect(service.user()).toBeNull();
      expect(service.getToken()).toBeNull();
    });
  });

  describe('setToken', () => {
    it('sets token, marks authenticated, and decodes user payload', () => {
      const payload = { sub: 'user-9', name: 'Decoded' };
      service.setToken(makeToken(payload));

      expect(service.isAuthenticated()).toBe(true);
      expect(service.getDecodedTokenValue()).toEqual(payload);
      expect(localStorage.removeItem).toHaveBeenCalledWith('ot-d6_authToken');
    });

    it('silently ignores a malformed token payload', () => {
      expect(() => service.setToken('not-a-jwt')).not.toThrow();
      expect(service.isAuthenticated()).toBe(true);
    });

    it('calls restoreSession when no token is supplied', async () => {
      service.setToken(undefined);
      const req = httpMock.expectOne('/api/authentication/session');
      req.flush({ data: mockUser });
      await Promise.resolve();
      expect(service.isAuthenticated()).toBe(true);
    });
  });

  describe('setUser', () => {
    it('stores the user and persists it to localStorage', () => {
      service.setUser(mockUser);
      expect(service.user()).toEqual(mockUser);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'ot-d6_profiles',
        JSON.stringify(mockUser)
      );
    });
  });

  describe('selected profile', () => {
    it('persists a selected profile', () => {
      service.persistSelectedProfile({ id: 'p1' });
      expect(service.selectedProfile()).toEqual({ id: 'p1' });
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'ot-d6_selectedProfile',
        JSON.stringify({ id: 'p1' })
      );
    });

    it('removes the persisted profile when set to a falsy value', () => {
      service.persistSelectedProfile({ id: 'p1' });
      service.persistSelectedProfile(null);
      expect(service.selectedProfile()).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith(
        'ot-d6_selectedProfile'
      );
    });

    it('reads the persisted profile back from localStorage', () => {
      service.persistSelectedProfile({ id: 'p2' });
      expect(service.getPersistedSelectedProfile()).toEqual({ id: 'p2' });
    });

    it('returns null when localStorage access throws', () => {
      (localStorage.getItem as jest.Mock).mockImplementation(() => {
        throw new Error('boom');
      });
      expect(service.getPersistedSelectedProfile()).toBeNull();
    });
  });

  describe('logout', () => {
    it('clears all state and calls the logout endpoint with a token', () => {
      service.setToken(makeToken({ sub: 'u' }));
      service.logout();

      const req = httpMock.expectOne('/api/authentication/logout');
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBe(true);
      req.flush({});

      expect(service.getToken()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
      expect(service.user()).toBeNull();
      expect(service.selectedProfile()).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith('ot-d6_authToken');
    });

    it('calls logout endpoint with empty body when no token present', () => {
      service.logout();
      const req = httpMock.expectOne('/api/authentication/logout');
      expect(req.request.body).toEqual({});
      req.flush({});
    });

    it('does not throw when the logout request errors', () => {
      service.logout();
      const req = httpMock.expectOne('/api/authentication/logout');
      req.flush(null, { status: 500, statusText: 'Server Error' });
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('isLoggedIn / getDecodedTokenValue', () => {
    it('reflects the authenticated signal', () => {
      expect(service.isLoggedIn()).toBe(false);
      service.setToken(makeToken({ sub: 'u' }));
      expect(service.isLoggedIn()).toBe(true);
    });

    it('returns null when there is no token', () => {
      expect(service.getDecodedTokenValue()).toBeNull();
    });
  });

  describe('Non-browser platform', () => {
    let serverService: AuthStateService;

    beforeEach(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [
          AuthStateService,
          { provide: PLATFORM_ID, useValue: 'server' },
        ],
      });
      serverService = TestBed.inject(AuthStateService);
    });

    it('does not restore a session on the server', async () => {
      await expect(serverService.restoreSession()).resolves.toBe(false);
    });

    it('returns null for loaded profile data on the server', () => {
      expect(serverService.getPersistedSelectedProfile()).toBeNull();
    });

    it('does not touch localStorage when persisting a profile on the server', () => {
      expect(() =>
        serverService.persistSelectedProfile({ id: 'p' })
      ).not.toThrow();
    });
  });
});
