import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { AuthSessionService } from './auth-session.service';

describe('AuthSessionService', () => {
  let service: AuthSessionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthSessionService,
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    service = TestBed.inject(AuthSessionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('restores a cookie session with the configurable-client app scope', async () => {
    expect(service.status).toBe('loading');

    const restore = service.restoreSession();
    const request = http.expectOne('/api/authentication/session');

    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('X-ot-appscope')).toBe(
      'configurable-client'
    );
    request.flush({ data: { userId: 'owner-1', email: 'owner@example.com' } });

    await expect(restore).resolves.toBe(true);
    expect(service.status).toBe('signed-in');
  });

  it('models an unavailable cookie session as signed out without requesting configuration', async () => {
    const restore = service.restoreSession();
    http.expectOne('/api/authentication/session').flush(null, {
      status: 401,
      statusText: 'Unauthenticated',
    });

    await expect(restore).resolves.toBe(false);
    expect(service.status).toBe('signed-out');
  });

  it('uses cookie-mode login and restores the established session', async () => {
    const login = service.login({
      email: 'owner@example.com',
      password: 'secret',
    });
    const loginRequest = http.expectOne('/api/authentication/login');

    expect(loginRequest.request.withCredentials).toBe(true);
    expect(loginRequest.request.headers.get('X-ot-session-mode')).toBe(
      'cookie'
    );
    expect(loginRequest.request.headers.get('X-ot-appscope')).toBe(
      'configurable-client'
    );
    loginRequest.flush({ data: {} });
    await Promise.resolve();

    const sessionRequest = http.expectOne('/api/authentication/session');
    sessionRequest.flush({ data: { userId: 'owner-1' } });

    await expect(login).resolves.toBe(true);
    expect(service.status).toBe('signed-in');
  });

  it('marks a signed-in session as expired when a later restore fails', async () => {
    const firstRestore = service.restoreSession();
    http
      .expectOne('/api/authentication/session')
      .flush({ data: { userId: '1' } });
    await firstRestore;

    const secondRestore = service.restoreSession();
    http.expectOne('/api/authentication/session').flush(null, {
      status: 401,
      statusText: 'Expired',
    });

    await expect(secondRestore).resolves.toBe(false);
    expect(service.status).toBe('expired');
  });

  it('logs out with the configurable-client app scope', () => {
    service.logout();

    const request = http.expectOne('/api/authentication/logout');
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('X-ot-appscope')).toBe(
      'configurable-client'
    );

    request.flush({ success: true });
    expect(service.status).toBe('signed-out');
  });

  it('retains a safe recovery path when a session expires', () => {
    let state: unknown;
    const subscription = service.sessionState$.subscribe((next) => {
      state = next;
    });

    service.markExpired('/app/private-app?workspaceSlug=north-star');

    expect(state).toEqual({
      status: 'expired',
      returnTo: '/app/private-app?workspaceSlug=north-star',
    });

    subscription.unsubscribe();
  });
});
