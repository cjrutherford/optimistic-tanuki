import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { BusinessAuthService, BusinessAuthUser } from './business-auth.service';

const SESSION_KIND_KEY = 'business-site:session-kind';

describe('BusinessAuthService session lifecycle', () => {
  let service: BusinessAuthService;
  let httpMock: HttpTestingController;

  // The service resolves PLATFORM_ID and seeds its signals in field
  // initialisers, so the injector is only built once a test has decided which
  // platform it runs on and what sessionStorage already holds.
  function createService(platformId: 'browser' | 'server' = 'browser'): void {
    TestBed.configureTestingModule({
      providers: [
        BusinessAuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: platformId },
      ],
    });

    service = TestBed.inject(BusinessAuthService);
    httpMock = TestBed.inject(HttpTestingController);
  }

  function establishOwnerSession(): void {
    service.loginAndExchange('owner@example.com', 'secret').subscribe();

    httpMock.expectOne('/api/authentication/login').flush({ data: {} });
    httpMock.expectOne('/api/authentication/session').flush({
      data: {
        userId: 'owner-1',
        profileId: 'profile-1',
        email: 'owner@example.com',
        name: 'Jordan Owner',
      },
    });
  }

  function establishClientSession(): void {
    service.loginClient('client@example.com', 'secret').subscribe();

    httpMock.expectOne('/api/authentication/login').flush({ data: {} });
    httpMock.expectOne('/api/authentication/session').flush({
      data: {
        userId: 'client-1',
        profileId: 'client-profile-1',
        email: 'client@example.com',
      },
    });
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('login', () => {
    it('sends the cookie-scoped login request and exchanges the returned token', () => {
      createService();
      const emitted: { token: string }[] = [];

      service
        .login('owner@example.com', 'secret')
        .subscribe((result) => emitted.push(result));

      const loginRequest = httpMock.expectOne('/api/authentication/login');
      expect(loginRequest.request.method).toBe('POST');
      expect(loginRequest.request.body).toEqual({
        email: 'owner@example.com',
        password: 'secret',
      });
      expect(loginRequest.request.headers.get('x-ot-appscope')).toBe(
        'business-site'
      );
      expect(loginRequest.request.headers.get('X-ot-session-mode')).toBe(
        'cookie'
      );
      expect(loginRequest.request.headers.get('Authorization')).toBeNull();
      expect(loginRequest.request.withCredentials).toBe(true);
      loginRequest.flush({ token: 'base-token' });

      const exchangeRequest = httpMock.expectOne(
        '/api/authentication/exchange'
      );
      expect(exchangeRequest.request.method).toBe('POST');
      expect(exchangeRequest.request.body).toEqual({
        targetAppId: 'business-site',
      });
      expect(exchangeRequest.request.headers.get('Authorization')).toBe(
        'Bearer base-token'
      );
      expect(exchangeRequest.request.withCredentials).toBe(true);
      exchangeRequest.flush({
        token: 'scoped-token',
        profileId: 'profile-1',
        targetAppId: 'business-site',
      });

      expect(emitted).toEqual([{ token: 'base-token' }]);
    });

    it('leaves the owner session unauthenticated because login stores nothing', () => {
      createService();

      service.login('owner@example.com', 'secret').subscribe();

      httpMock
        .expectOne('/api/authentication/login')
        .flush({ token: 'base-token' });
      httpMock
        .expectOne('/api/authentication/exchange')
        .flush({ token: 'scoped-token', profileId: 'profile-1' });

      expect(service.user()).toBeNull();
      expect(service.token()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
      expect(service.getAuthHeaders()).toEqual({});
    });

    const tokenPrecedenceCases: ReadonlyArray<{
      readonly label: string;
      readonly loginResponse: Record<string, unknown>;
      readonly expectedBearer: string;
    }> = [
      {
        label: 'data.newToken ahead of every other token field',
        loginResponse: {
          data: { newToken: 'data-new', token: 'data-old' },
          newToken: 'root-new',
          token: 'root-old',
        },
        expectedBearer: 'data-new',
      },
      {
        label: 'data.token ahead of the root-level tokens',
        loginResponse: {
          data: { token: 'data-old' },
          newToken: 'root-new',
          token: 'root-old',
        },
        expectedBearer: 'data-old',
      },
      {
        label: 'root newToken ahead of the root token',
        loginResponse: { newToken: 'root-new', token: 'root-old' },
        expectedBearer: 'root-new',
      },
      {
        label: 'root token as the last resort',
        loginResponse: { token: 'root-old' },
        expectedBearer: 'root-old',
      },
    ];

    it.each(tokenPrecedenceCases)(
      'picks $label when exchanging for app scope',
      ({ loginResponse, expectedBearer }) => {
        createService();

        service.login('owner@example.com', 'secret').subscribe();

        httpMock.expectOne('/api/authentication/login').flush(loginResponse);

        const exchangeRequest = httpMock.expectOne(
          '/api/authentication/exchange'
        );
        expect(exchangeRequest.request.headers.get('Authorization')).toBe(
          `Bearer ${expectedBearer}`
        );
        exchangeRequest.flush({ token: 'scoped-token', profileId: 'p-1' });
      }
    );

    it('skips the app-scope exchange when the login response carries no token', () => {
      createService();
      const emitted: { token: string }[] = [];

      service
        .login('owner@example.com', 'secret')
        .subscribe((result) => emitted.push(result));

      httpMock
        .expectOne('/api/authentication/login')
        .flush({ data: { profileId: 'profile-1' } });

      httpMock.expectNone('/api/authentication/exchange');
      expect(emitted).toEqual([{ data: { profileId: 'profile-1' } }]);
      expect(service.isAuthenticated()).toBe(false);
    });

    it('rethrows a rejected login and never reaches the exchange endpoint', () => {
      createService();
      const errors: HttpErrorResponse[] = [];

      service.login('owner@example.com', 'wrong').subscribe({
        error: (error: HttpErrorResponse) => errors.push(error),
      });

      httpMock
        .expectOne('/api/authentication/login')
        .flush(
          { message: 'Invalid credentials' },
          { status: 401, statusText: 'Unauthorized' }
        );

      expect(errors).toHaveLength(1);
      expect(errors[0].status).toBe(401);
      httpMock.expectNone('/api/authentication/exchange');
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('exchangeForAppScope', () => {
    it('authorises the exchange with the supplied base token and returns the scoped token', () => {
      createService();
      const emitted: { token: string; profileId: string }[] = [];

      service
        .exchangeForAppScope('base-token')
        .subscribe((result) => emitted.push(result));

      const exchangeRequest = httpMock.expectOne(
        '/api/authentication/exchange'
      );
      expect(exchangeRequest.request.method).toBe('POST');
      expect(exchangeRequest.request.body).toEqual({
        targetAppId: 'business-site',
      });
      expect(exchangeRequest.request.headers.get('Authorization')).toBe(
        'Bearer base-token'
      );
      expect(exchangeRequest.request.headers.get('x-ot-appscope')).toBe(
        'business-site'
      );
      expect(exchangeRequest.request.withCredentials).toBe(true);
      exchangeRequest.flush({
        token: 'scoped-token',
        profileId: 'profile-1',
        targetAppId: 'business-site',
      });

      expect(emitted).toEqual([
        {
          token: 'scoped-token',
          profileId: 'profile-1',
          targetAppId: 'business-site',
        },
      ]);
      // The exchange deliberately does not hydrate the session; the login flow
      // owns that step.
      expect(service.token()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('restoreSession', () => {
    it('resolves to false on the server without touching the session endpoint', () => {
      sessionStorage.setItem(SESSION_KIND_KEY, 'owner');
      createService('server');
      const restored: boolean[] = [];

      service.restoreSession().subscribe((value) => restored.push(value));

      httpMock.expectNone('/api/authentication/session');
      expect(restored).toEqual([false]);
      expect(service.isAuthenticated()).toBe(false);
      expect(service.isClientAuthenticated()).toBe(false);
    });

    const unusableKinds: ReadonlyArray<{
      readonly label: string;
      readonly kind: string | null;
    }> = [
      { label: 'no session kind has been recorded', kind: null },
      { label: 'the session kind is unrecognised', kind: 'guest' },
      { label: 'the session kind is blank', kind: '' },
    ];

    it.each(unusableKinds)('resolves to false when $label', ({ kind }) => {
      if (kind !== null) {
        sessionStorage.setItem(SESSION_KIND_KEY, kind);
      }
      createService();
      const restored: boolean[] = [];

      service.restoreSession().subscribe((value) => restored.push(value));

      httpMock.expectNone('/api/authentication/session');
      expect(restored).toEqual([false]);
    });

    it('rehydrates the owner session from the cookie session endpoint', () => {
      sessionStorage.setItem(SESSION_KIND_KEY, 'owner');
      createService();
      const restored: boolean[] = [];

      service.restoreSession().subscribe((value) => restored.push(value));

      const sessionRequest = httpMock.expectOne('/api/authentication/session');
      expect(sessionRequest.request.method).toBe('GET');
      expect(sessionRequest.request.headers.get('x-ot-appscope')).toBe(
        'business-site'
      );
      expect(sessionRequest.request.headers.get('Authorization')).toBeNull();
      expect(sessionRequest.request.withCredentials).toBe(true);
      sessionRequest.flush({
        data: {
          userId: 'owner-1',
          profileId: 'profile-1',
          email: 'owner@example.com',
          name: 'Jordan Owner',
        },
      });

      expect(restored).toEqual([true]);
      expect(service.user()).toEqual({
        userId: 'owner-1',
        profileId: 'profile-1',
        email: 'owner@example.com',
        name: 'Jordan Owner',
      });
      expect(service.isAuthenticated()).toBe(true);
      expect(service.clientUser()).toBeNull();
      expect(service.isClientAuthenticated()).toBe(false);
    });

    it('rehydrates the client session and defaults the missing profile and name', () => {
      sessionStorage.setItem(SESSION_KIND_KEY, 'client');
      createService();
      const restored: boolean[] = [];

      service.restoreSession().subscribe((value) => restored.push(value));

      httpMock
        .expectOne('/api/authentication/session')
        .flush({ data: { userId: 'client-1' } });

      expect(restored).toEqual([true]);
      expect(service.clientUser()).toEqual({
        userId: 'client-1',
        profileId: '',
        email: '',
        name: '',
      });
      expect(service.isClientAuthenticated()).toBe(true);
      expect(service.user()).toBeNull();
    });

    it('drops both sessions and the session-kind marker when the cookie session is rejected', () => {
      createService();
      establishOwnerSession();
      expect(service.isAuthenticated()).toBe(true);
      expect(sessionStorage.getItem(SESSION_KIND_KEY)).toBe('owner');

      const restored: boolean[] = [];
      service.restoreSession().subscribe((value) => restored.push(value));

      httpMock
        .expectOne('/api/authentication/session')
        .flush(
          { message: 'Session expired' },
          { status: 401, statusText: 'Unauthorized' }
        );

      expect(restored).toEqual([false]);
      expect(service.user()).toBeNull();
      expect(service.clientUser()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
      expect(sessionStorage.getItem(SESSION_KIND_KEY)).toBeNull();
    });
  });

  describe('logout', () => {
    it('clears the owner session and its session-kind marker', () => {
      createService();
      establishOwnerSession();

      service.logout();

      // A cookie session never carries a bearer token, so no revocation call is
      // made — see the note in the accompanying report.
      httpMock.expectNone('/api/authentication/logout');
      expect(service.user()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
      expect(service.getAuthHeaders()).toEqual({});
      expect(sessionStorage.getItem(SESSION_KIND_KEY)).toBeNull();
    });

    it('leaves the session-kind marker alone on the server where there is no storage', () => {
      createService('server');

      expect(() => service.logout()).not.toThrow();

      httpMock.expectNone('/api/authentication/logout');
      expect(service.user()).toBeNull();
    });

    it('clears the client session and its session-kind marker', () => {
      createService();
      establishClientSession();
      expect(service.isClientAuthenticated()).toBe(true);
      expect(sessionStorage.getItem(SESSION_KIND_KEY)).toBe('client');

      service.logoutClient();

      httpMock.expectNone('/api/authentication/logout');
      expect(service.clientUser()).toBeNull();
      expect(service.isClientAuthenticated()).toBe(false);
      expect(service.clientToken()).toBeNull();
      expect(service.getClientAuthHeaders()).toEqual({});
      expect(sessionStorage.getItem(SESSION_KIND_KEY)).toBeNull();
    });

    it('keeps the owner session intact when only the client session is dropped', () => {
      createService();
      establishOwnerSession();
      const owner: BusinessAuthUser | null = service.user();

      service.logoutClient();

      expect(service.clientUser()).toBeNull();
      expect(service.user()).toEqual(owner);
      expect(service.isAuthenticated()).toBe(true);
    });
  });
});
