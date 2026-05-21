import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { AuthStateService, LoginRequest } from './auth-state.service';
import { PLATFORM_ID } from '@angular/core';
import * as jwtDecodeModule from 'jwt-decode';

jest.mock('jwt-decode', () => ({
  jwtDecode: jest.fn(),
}));

describe('AuthStateService', () => {
  let service: AuthStateService;
  let httpMock: HttpTestingController;

  const mockToken = 'mock-jwt-token';
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
    (jwtDecodeModule.jwtDecode as jest.Mock).mockReturnValue(mockUserData);
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
      const mockResponse = { data: { newToken: mockToken } };

      const loginPromise = service.login(loginRequest);

      const req = httpMock.expectOne('/api/authentication/login');
      expect(req.request.method).toBe('POST');
      req.flush(mockResponse);

      const response = await loginPromise;
      expect(response).toEqual(mockResponse);
      expect(service.getToken()).toBe(mockToken);
      expect(service.isAuthenticated).toBe(true);
    });
  });

  describe('logout', () => {
    it('should clear token and authenticated state', () => {
      service.setToken(mockToken);
      expect(service.isAuthenticated).toBe(true);

      service.logout();

      expect(service.getToken()).toBeNull();
      expect(service.isAuthenticated).toBe(false);
      expect(localStorage.removeItem).toHaveBeenCalled();
    });
  });

  describe('token methods', () => {
    it('should return decoded token value', () => {
      service.setToken(mockToken);
      const decoded = service.getDecodedTokenValue();
      expect(decoded).toEqual(mockUserData);
    });

    it('should return profileId', () => {
      service.setToken(mockToken);
      expect(service.getProfileId()).toBe(mockUserData.profileId);
    });

    it('should return null for profileId if not authenticated', () => {
      service.logout();
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
        await expect(serverService.login({ username: 'u', password: 'p' })).rejects.toMatch('Login is not available');
    });
  });
});
