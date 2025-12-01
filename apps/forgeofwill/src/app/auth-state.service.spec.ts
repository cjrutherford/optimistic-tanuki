import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { jwtDecode } from 'jwt-decode';

import { AuthStateService, UserData } from './auth-state.service';
import { AuthenticationService } from './authentication.service';

// Mock jwt-decode
jest.mock('jwt-decode', () => ({
  jwtDecode: jest.fn(),
}));

describe('AuthStateService', () => {
  let service: AuthStateService;
  let authServiceMock: { login: jest.Mock };
  const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJuYW1lIjoiVGVzdCBVc2VyIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const mockDecodedToken: UserData = { userId: '123', name: 'Test User', email: 'test@example.com', profileId: 'profile123' };

  describe('when in a browser environment', () => {
    beforeEach(() => {
      authServiceMock = {
        login: jest.fn().mockResolvedValue({ data: { newToken: mockToken } }),
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
      Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

      (jwtDecode as jest.Mock).mockReturnValue(mockDecodedToken);
    });

    afterEach(() => {
      localStorage.clear();
      (jwtDecode as jest.Mock).mockClear();
    });

    it('should be created', () => {
      service = TestBed.inject(AuthStateService);
      expect(service).toBeTruthy();
    });

    it('should initialize with token from localStorage', () => {
        localStorage.setItem('authToken', mockToken);
        service = TestBed.inject(AuthStateService);
        expect(service.getToken()).toBe(mockToken);
        service.isAuthenticated$().subscribe(isAuth => expect(isAuth).toBe(true));
        service.decodedToken$().subscribe(decoded => expect(decoded).toEqual(mockDecodedToken));
    });

    it('should set token, update subjects, and call localStorage on setToken', () => {
      service = TestBed.inject(AuthStateService);
      const setItemSpy = jest.spyOn(localStorage, 'setItem');
      service.setToken(mockToken);

      expect(service.getToken()).toBe(mockToken);
      service.isAuthenticated$().subscribe(isAuth => expect(isAuth).toBe(true));
      service.decodedToken$().subscribe(decoded => expect(decoded).toEqual(mockDecodedToken));
      expect(setItemSpy).toHaveBeenCalledWith('authToken', mockToken);
    });

    it('should call authService.login and set token on successful login', async () => {
      service = TestBed.inject(AuthStateService);
      const setTokenSpy = jest.spyOn(service, 'setToken');
      const loginRequest = { email: 'test@example.com', password: 'password' };

      await service.login(loginRequest);

      expect(authServiceMock.login).toHaveBeenCalledWith(loginRequest);
      expect(setTokenSpy).toHaveBeenCalledWith(mockToken);
    });

    it('should clear token and update subjects on logout', () => {
        localStorage.setItem('authToken', mockToken);
        service = TestBed.inject(AuthStateService);
        const removeItemSpy = jest.spyOn(localStorage, 'removeItem');

        service.logout();

        expect(service.getToken()).toBeNull();
        service.isAuthenticated$().subscribe(isAuth => expect(isAuth).toBe(false));
        service.decodedToken$().subscribe(decoded => expect(decoded).toBeNull());
        expect(removeItemSpy).toHaveBeenCalledWith('authToken');
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
        service.isAuthenticated$().subscribe(isAuth => expect(isAuth).toBe(false));
        service.decodedToken$().subscribe(decoded => expect(decoded).toBeNull());
    });

    it('should not set token', () => {
        service.setToken(mockToken);
        expect(service.getToken()).toBeNull();
    });

    it('should reject login promise', async () => {
        await expect(service.login({ email: 'test@example.com', password: 'password' })).rejects.toEqual('Login is not available on this platform.');
    });

    it('logout should not throw error', () => {
        expect(() => service.logout()).not.toThrow();
    });
  });
});
