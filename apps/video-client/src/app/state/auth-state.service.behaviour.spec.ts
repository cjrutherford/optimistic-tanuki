import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { AuthStateService, DecodedToken } from './auth-state.service';

const sessionUser: DecodedToken = {
  userId: 'viewer-1',
  profileId: 'profile-1',
  email: 'viewer@example.com',
  exp: 1_800_000_000,
  iat: 1_700_000_000,
};

describe('AuthStateService behaviour', () => {
  let service: AuthStateService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        AuthStateService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    service = TestBed.inject(AuthStateService);
    http = TestBed.inject(HttpTestingController);
    // The constructor restores the session on the browser platform; every test
    // starts from the unauthenticated outcome of that probe.
    http
      .expectOne('/api/authentication/session')
      .flush(null, { status: 401, statusText: 'Unauthenticated' });
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('leaves the caller unauthenticated when the session probe fails', () => {
    expect(service.isAuthenticated).toBe(false);
    expect(service.getToken()).toBeNull();
    expect(service.getDecodedTokenValue()).toBeNull();
  });

  it('rejects a login whose response carries no body', async () => {
    const login = service.login({
      email: 'viewer@example.com',
      password: 'password',
    });

    const request = http.expectOne('/api/authentication/login');
    expect(request.request.headers.get('x-ot-app-id')).toBe('video-platform');
    expect(request.request.body).toEqual({
      email: 'viewer@example.com',
      password: 'password',
    });
    request.flush(null);

    await expect(login).rejects.toThrow('Login failed');
    expect(service.isAuthenticated).toBe(false);
  });

  it('marks the caller authenticated when a token is set explicitly', async () => {
    service.setToken('jwt-token');

    expect(service.getToken()).toBe('jwt-token');
    expect(service.isAuthenticated).toBe(true);
    await expect(firstValueFrom(service.token$)).resolves.toBe('jwt-token');
    await expect(firstValueFrom(service.isAuthenticated$)).resolves.toBe(true);
  });

  it('clears the session, drops the stored profile and posts a logout', async () => {
    const restore = service.restoreSession();
    http.expectOne('/api/authentication/session').flush({ data: sessionUser });
    await restore;
    localStorage.setItem(
      'selectedProfile',
      JSON.stringify({ id: 'profile-1' })
    );

    service.logout();

    const request = http.expectOne('/api/authentication/logout');
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    request.flush(null);

    expect(service.isAuthenticated).toBe(false);
    expect(service.getToken()).toBeNull();
    expect(service.getDecodedTokenValue()).toBeNull();
    expect(localStorage.getItem('selectedProfile')).toBeNull();
  });

  it('still clears local state when the logout request fails', () => {
    service.setToken('jwt-token');

    service.logout();

    http
      .expectOne('/api/authentication/logout')
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(service.isAuthenticated).toBe(false);
    expect(service.getToken()).toBeNull();
  });

  it('emits the restored session user through getDecodedToken and completes', async () => {
    const restore = service.restoreSession();
    http.expectOne('/api/authentication/session').flush({ data: sessionUser });
    await restore;

    const emissions: (DecodedToken | null)[] = [];
    let completed = false;
    service.getDecodedToken().subscribe({
      next: (decoded) => emissions.push(decoded),
      complete: () => (completed = true),
    });

    expect(emissions).toEqual([sessionUser]);
    expect(completed).toBe(true);
  });
});

describe('AuthStateService on the server platform', () => {
  let service: AuthStateService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthStateService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    });
    service = TestBed.inject(AuthStateService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('does not probe the session endpoint during server rendering', async () => {
    await service.restoreSession();

    http.expectNone('/api/authentication/session');
    expect(service.isAuthenticated).toBe(false);
  });
});
