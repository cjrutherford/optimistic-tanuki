import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { API_BASE_URL, LoginRequest } from '@optimistic-tanuki/ui-models';
import { AuthenticationService } from './authentication.service';

describe('AuthenticationService', () => {
  let service: AuthenticationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthenticationService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    });
    service = TestBed.inject(AuthenticationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('starts a cookie session without returning a bearer token', async () => {
    const login: LoginRequest = {
      email: 'operator@example.com',
      password: 'password',
    };
    const result = service.login(login);

    const req = httpMock.expectOne('/api/authentication/login');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-ot-session-mode')).toBe('cookie');
    req.flush({ data: {} });

    await expect(result).resolves.toEqual({ data: {} });
  });

  it('switches profile in the cookie session without exposing its token', async () => {
    const result = service.issue({ profileId: 'leads-profile' });

    const req = httpMock.expectOne('/api/authentication/issue');
    expect(req.request.body).toEqual({ profileId: 'leads-profile' });
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-ot-session-mode')).toBe('cookie');
    req.flush({ data: {} });

    await expect(result).resolves.toEqual({ data: {} });
  });

  it('reads the cookie session identity', async () => {
    const result = service.currentSession();

    const req = httpMock.expectOne('/api/authentication/session');
    expect(req.request.withCredentials).toBe(true);
    req.flush({
      data: {
        user: {
          userId: 'user-1',
          name: 'Operator',
          email: 'operator@example.com',
          profileId: 'leads-profile',
        },
      },
    });

    await expect(result).resolves.toMatchObject({
      data: { user: { profileId: 'leads-profile' } },
    });
  });
});
