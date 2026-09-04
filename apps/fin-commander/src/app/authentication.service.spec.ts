import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { AuthenticationService } from './authentication.service';

function makeToken(payload: Record<string, unknown>): string {
  return `header.${btoa(JSON.stringify(payload))}.signature`;
}

describe('AuthenticationService', () => {
  let service: AuthenticationService;
  let http: HttpTestingController;

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
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('normalises the email when registering', () => {
    service
      .register({
        email: '  Captain@Example.COM ',
        password: 'secret',
      } as never)
      .subscribe();

    const req = http.expectOne('/api/authentication/register');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.email).toBe('captain@example.com');
    expect(req.request.body.password).toBe('secret');
    req.flush({});
  });

  it('logs in with the cookie session headers and a normalised email', async () => {
    const pending = service.login({
      email: 'Captain@Example.com',
      password: 'secret',
    } as never);

    const req = http.expectOne('/api/authentication/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.email).toBe('captain@example.com');
    expect(req.request.headers.get('X-ot-session-mode')).toBe('cookie');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ data: { newToken: 'a.b.c' } });

    await expect(pending).resolves.toEqual({ data: { newToken: 'a.b.c' } });
  });

  it('reads the current session with credentials', async () => {
    const pending = service.currentSession();

    const req = http.expectOne('/api/authentication/session');
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ data: { id: 'user-1' } });

    await expect(pending).resolves.toEqual({ data: { id: 'user-1' } });
  });

  it('publishes the decoded token payload and clears it once it expires', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const exp = Math.floor(Date.now() / 1000) + 60;
    service.setToken(makeToken({ userId: 'user-1', exp }));

    expect(service.isAuthenticated.value).toBe(true);
    expect(service.userData.value).toMatchObject({ userId: 'user-1' });

    jest.advanceTimersByTime(60_000);

    expect(service.isAuthenticated.value).toBe(false);
    expect(service.userData.value).toBeNull();

    jest.useRealTimers();
  });

  it('expires a token without an exp claim immediately', () => {
    jest.useFakeTimers();

    service.setToken(makeToken({ userId: 'user-1' }));
    expect(service.isAuthenticated.value).toBe(true);

    jest.advanceTimersByTime(0);

    expect(service.isAuthenticated.value).toBe(false);
    jest.useRealTimers();
  });
});
