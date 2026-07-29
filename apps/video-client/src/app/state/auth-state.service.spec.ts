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

  beforeEach(() => {
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

  afterEach(() => httpMock.verify());

  it('restores session identity after a cookie-mode login without storing a JWT', async () => {
    const login = service.login({
      email: 'viewer@example.com',
      password: 'password',
    });
    const loginRequest = httpMock.expectOne('/api/authentication/login');
    expect(loginRequest.request.headers.get('X-ot-session-mode')).toBe(
      'cookie'
    );
    expect(loginRequest.request.withCredentials).toBe(true);
    loginRequest.flush({ data: {} });
    await login;

    const restore = service.restoreSession();
    const sessionRequest = httpMock.expectOne('/api/authentication/session');
    expect(sessionRequest.request.withCredentials).toBe(true);
    sessionRequest.flush({
      data: {
        user: {
          userId: 'viewer-1',
          email: 'viewer@example.com',
          name: 'Viewer',
          profileId: '',
        },
      },
    });
    await restore;

    expect(service.getToken()).toBeNull();
    expect(service.isAuthenticated).toBe(true);
    expect(service.getDecodedTokenValue()).toMatchObject({
      userId: 'viewer-1',
    });
    expect(localStorage.getItem('authToken')).toBeNull();
  });
});
