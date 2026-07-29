import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { AuthenticationService } from './authentication.service';

describe('AuthenticationService', () => {
  let service: AuthenticationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: API_BASE_URL, useValue: '/api' }],
    });
    service = TestBed.inject(AuthenticationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('uses a cookie session for login and bootstrap', async () => {
    const login = service.login({
      email: 'hai@example.com',
      password: 'secret',
    });
    const loginRequest = httpMock.expectOne('/api/authentication/login');
    expect(loginRequest.request.headers.get('X-ot-session-mode')).toBe(
      'cookie'
    );
    expect(loginRequest.request.withCredentials).toBe(true);
    loginRequest.flush({ data: {} });
    await login;

    const session = service.currentSession();
    const sessionRequest = httpMock.expectOne('/api/authentication/session');
    expect(sessionRequest.request.withCredentials).toBe(true);
    sessionRequest.flush({
      data: { user: { userId: 'hai-1', profileId: 'profile-1' } },
    });
    await expect(session).resolves.toEqual({
      data: { user: { userId: 'hai-1', profileId: 'profile-1' } },
    });
  });
});
