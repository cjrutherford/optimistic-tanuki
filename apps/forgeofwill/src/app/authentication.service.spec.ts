import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { AuthenticationService } from './authentication.service';
import { LoginRequest, RegisterRequest, UserDto } from '@optimistic-tanuki/ui-models';

describe('AuthenticationService', () => {
  let service: AuthenticationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(AuthenticationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('register', () => {
    it('should register a user successfully', () => {
      const mockRegister: RegisterRequest = { email: 'test@example.com', password: 'password', fn: 'Test', ln: 'User', confirm: 'password', bio: 'Some bio' };

      service.register(mockRegister).subscribe(response => {
        expect(response).toBeTruthy();
      });

      const req = httpMock.expectOne('/api/authentication/register');
      expect(req.request.method).toBe('POST');
      req.flush({});
    });
  });

  describe('login', () => {
    it('should log in a user successfully', fakeAsync(() => {
      const mockLogin: LoginRequest = { email: 'test@example.com', password: 'password' };
      const mockToken = 'mock-jwt-token';
      const expectedResponse = { data: { newToken: mockToken } };

      service.login(mockLogin).then(result => {
        expect(result).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne('/api/authentication/login');
      expect(req.request.method).toBe('POST');
      req.flush(expectedResponse);
      tick();
    }));
  });

  describe('setToken', () => {
    it('should set authentication state and user data', () => {
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJuYW1lIjoiVGVzdCBVc2VyIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjN9.signature';
      const mockUser: UserDto = { userId: '123', name: 'Test User', email: 'test@example.com', iat: 1516239022, exp: 1516239023 };

      service.setToken(mockToken);

      expect(service.isAuthenticated.value).toBe(true);
      expect(service.userData.value).toEqual(mockUser);
    });

    it('should clear authentication state and user data after token expiration', fakeAsync(() => {
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJuYW1lIjoiVGVzdCBVc2VyIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjN9.signature'; // Expires in 1 second

      service.setToken(mockToken);

      expect(service.isAuthenticated.value).toBe(true);
      expect(service.userData.value).toBeTruthy();

      tick(1000); // Advance time by 1 second

      expect(service.isAuthenticated.value).toBe(false);
      expect(service.userData.value).toBeNull();
    }));
  });
});
