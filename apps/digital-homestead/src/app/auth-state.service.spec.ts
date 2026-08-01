import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { AuthStateService, LoginRequest } from './auth-state.service';
import { PLATFORM_ID } from '@angular/core';

describe('AuthStateService', () => {
  let service: AuthStateService;
  let httpMock: HttpTestingController;

  const mockUserData = {
    userId: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    profileId: 'profile-456',
  };

  beforeEach(() => {
    // Mock localStorage
    const store: Record<string, string> = {};
    const localStorageMock = {
      getItem: jest.fn((key: string) => store[key] || null),
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
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });

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

  describe('login', () => {
    it('should perform login and set token', async () => {
      const loginRequest: LoginRequest = {
        username: 'test@example.com',
        password: 'password123',
      };
      const mockResponse = { data: {} };

      const loginPromise = service.login(loginRequest);

      const req = httpMock.expectOne('/api/authentication/login');
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.get('X-ot-session-mode')).toBe('cookie');
      expect(req.request.withCredentials).toBe(true);
      req.flush(mockResponse);
      await Promise.resolve();

      const sessionRequest = httpMock.expectOne('/api/authentication/session');
      expect(sessionRequest.request.withCredentials).toBe(true);
      sessionRequest.flush({ data: { user: mockUserData } });

      const response = await loginPromise;
      expect(response).toEqual(mockResponse);
      expect(service.getToken()).toBeNull();
      expect(service.isAuthenticated).toBe(true);
    });
  });

  describe('restoreSession', () => {
    it('hydrates authenticated state from the HttpOnly session endpoint without storing a token', async () => {
      const restored = service.restoreSession();
      const req = httpMock.expectOne('/api/authentication/session');
      expect(req.request.withCredentials).toBe(true);
      req.flush({ data: { user: mockUserData } });

      await expect(restored).resolves.toBe(true);
      expect(service.isAuthenticated).toBe(true);
      expect(service.getToken()).toBeNull();
      expect(service.getDecodedTokenValue()).toEqual(mockUserData);
    });
  });

  describe('logout', () => {
    it('should clear token and authenticated state', () => {
      service.setToken('mock-jwt-token');
      expect(service.isAuthenticated).toBe(true);

      service.logout();

      const logoutRequest = httpMock.expectOne('/api/authentication/logout');
      expect(logoutRequest.request.withCredentials).toBe(true);
      logoutRequest.flush({});

      expect(service.getToken()).toBeNull();
      expect(service.isAuthenticated).toBe(false);
      expect(localStorage.removeItem).not.toHaveBeenCalledWith(
        'dh-client-authToken'
      );
    });
  });

  describe('token methods', () => {
    it('should return session-derived identity and profileId', async () => {
      const restore = service.restoreSession();
      const req = httpMock.expectOne('/api/authentication/session');
      req.flush({ data: { user: mockUserData } });
      await restore;
      expect(service.getDecodedTokenValue()).toEqual(mockUserData);
      expect(service.getProfileId()).toBe(mockUserData.profileId);
    });

    it('should return null for profileId if not authenticated', () => {
      service.logout();
      httpMock.expectOne('/api/authentication/logout').flush({});
      expect(service.getProfileId()).toBeNull();
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

    it('should return false for isAuthenticated on server', () => {
      expect(serverService.isAuthenticated).toBe(false);
    });

    it('should return null for token on server', () => {
      expect(serverService.getToken()).toBeNull();
    });

    it('should reject login on server', async () => {
      await expect(
        serverService.login({ username: 'u', password: 'p' })
      ).rejects.toMatch('Login is not available');
    });
  });
});
