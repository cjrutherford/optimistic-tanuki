import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { BusinessAuthService } from './business-auth.service';

describe('BusinessAuthService', () => {
  let service: BusinessAuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        BusinessAuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(BusinessAuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('creates a cookie session for owner login without persisting a token', () => {
    let storedUser: unknown = null;

    service
      .loginAndExchange('owner@example.com', 'secret')
      .subscribe((user) => {
        storedUser = user;
      });

    const loginRequest = httpMock.expectOne('/api/authentication/login');
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
    expect(loginRequest.request.withCredentials).toBe(true);
    loginRequest.flush({ data: {} });

    const sessionRequest = httpMock.expectOne('/api/authentication/session');
    expect(sessionRequest.request.withCredentials).toBe(true);
    sessionRequest.flush({
      data: {
        userId: 'owner-1',
        profileId: 'profile-1',
        email: 'owner@example.com',
      },
    });

    expect(storedUser).toEqual({
      userId: 'owner-1',
      profileId: 'profile-1',
      email: 'owner@example.com',
      name: '',
    });
    expect(service.authState()).toEqual({
      status: 'signed-in',
      identity: {
        userId: 'owner-1',
        profileId: 'profile-1',
        email: 'owner@example.com',
        name: '',
      },
      session: {
        kind: 'owner',
        appScope: 'business-site',
        transport: 'cookie',
      },
      recovery: null,
    });
    expect(localStorage.getItem('business-site:token')).toBeNull();
  });

  it('registers client accounts in the business-site app scope', () => {
    service
      .registerClient({
        fn: 'Casey',
        ln: 'Client',
        email: 'client@example.com',
        password: 'supersecret',
        confirm: 'supersecret',
        bio: 'Looking for structured support.',
      })
      .subscribe();

    const registerRequest = httpMock.expectOne('/api/authentication/register');
    expect(registerRequest.request.method).toBe('POST');
    expect(registerRequest.request.headers.get('x-ot-appscope')).toBe(
      'business-site'
    );
    expect(registerRequest.request.body).toEqual({
      fn: 'Casey',
      ln: 'Client',
      email: 'client@example.com',
      password: 'supersecret',
      confirm: 'supersecret',
      bio: 'Looking for structured support.',
    });
    registerRequest.flush({ ok: true });
  });

  it('registers owner accounts in the business-site app scope', () => {
    service
      .registerOwner({
        fn: 'Jordan',
        ln: 'Owner',
        email: 'owner@example.com',
        password: 'supersecret',
        confirm: 'supersecret',
        bio: 'Launching a business site.',
      })
      .subscribe();

    const registerRequest = httpMock.expectOne('/api/authentication/register');
    expect(registerRequest.request.method).toBe('POST');
    expect(registerRequest.request.headers.get('x-ot-appscope')).toBe(
      'business-site'
    );
    expect(registerRequest.request.body).toEqual({
      fn: 'Jordan',
      ln: 'Owner',
      email: 'owner@example.com',
      password: 'supersecret',
      confirm: 'supersecret',
      bio: 'Launching a business site.',
    });
    registerRequest.flush({ ok: true });
  });

  it('claims owner access in the business-site app scope with the active token', () => {
    localStorage.setItem(
      'business-site:user',
      JSON.stringify({
        token: 'business-token',
        profileId: 'profile-1',
        userId: 'user-1',
        email: 'owner@example.com',
      })
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        BusinessAuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(BusinessAuthService);
    httpMock = TestBed.inject(HttpTestingController);

    service.claimOwnerAccess().subscribe();

    const claimRequest = httpMock.expectOne('/api/authentication/owner-access');
    expect(claimRequest.request.method).toBe('POST');
    expect(claimRequest.request.headers.get('x-ot-appscope')).toBe(
      'business-site'
    );
    expect(claimRequest.request.headers.get('Authorization')).toBeNull();
    expect(claimRequest.request.headers.get('x-ot-session-mode')).toBe(
      'cookie'
    );
    expect(claimRequest.request.withCredentials).toBe(true);
    claimRequest.flush({ ownerAccess: true });
  });

  it('waits for the cookie session restore before emitting client login success', () => {
    let emittedUser: { userId?: string } | null = null;

    service.loginClient('client@example.com', 'secret').subscribe((user) => {
      emittedUser = user;
    });

    const loginRequest = httpMock.expectOne('/api/authentication/login');
    loginRequest.flush({ data: {} });

    expect(emittedUser).toBeNull();

    const sessionRequest = httpMock.expectOne('/api/authentication/session');
    sessionRequest.flush({
      data: {
        userId: 'client-user-1',
        profileId: 'client-profile-1',
        email: 'client@example.com',
      },
    });

    expect(emittedUser).toEqual(
      expect.objectContaining({ userId: 'client-user-1' })
    );
    expect(localStorage.getItem('business-site:client-token')).toBeNull();
  });

  it('hydrates the client userId from the cookie session response', () => {
    let clientUserId = '';

    service.loginClient('client@example.com', 'secret').subscribe((user) => {
      clientUserId = user.userId;
    });

    const loginRequest = httpMock.expectOne('/api/authentication/login');
    expect(loginRequest.request.body).toEqual({
      email: 'client@example.com',
      password: 'secret',
    });
    loginRequest.flush({ data: {} });

    const sessionRequest = httpMock.expectOne('/api/authentication/session');
    sessionRequest.flush({
      data: {
        userId: 'client-user-1',
        profileId: 'client-profile-1',
        email: 'client@example.com',
      },
    });

    expect(clientUserId).toBe('client-user-1');
    expect(localStorage.getItem('business-site:client-user')).toBeNull();
  });

  it('refreshes the business client cookie session without accepting a client-supplied profile scope', () => {
    let refreshedUser: { userId?: string; profileId?: string } | null = null;

    service.refreshClientSession().subscribe((user) => {
      refreshedUser = user;
    });

    const sessionRequest = httpMock.expectOne('/api/authentication/session');
    expect(sessionRequest.request.method).toBe('GET');
    expect(sessionRequest.request.withCredentials).toBe(true);
    expect(sessionRequest.request.headers.get('x-ot-appscope')).toBe(
      'business-site'
    );
    expect(sessionRequest.request.headers.get('x-ot-profile-id')).toBeNull();
    sessionRequest.flush({
      data: {
        userId: 'client-user-1',
        profileId: 'client-profile-1',
        email: 'client@example.com',
      },
    });

    expect(refreshedUser).toEqual(
      expect.objectContaining({
        userId: 'client-user-1',
        profileId: 'client-profile-1',
      })
    );
  });

  it('logs out with an empty cookie-session request and clears all local auth state', () => {
    service.loginAndExchange('owner@example.com', 'secret').subscribe();

    httpMock.expectOne('/api/authentication/login').flush({ data: {} });
    httpMock.expectOne('/api/authentication/session').flush({
      data: {
        userId: 'owner-1',
        profileId: 'profile-1',
        email: 'owner@example.com',
      },
    });

    localStorage.setItem('business-site:user', 'legacy-owner');
    localStorage.setItem('business-site:token', 'legacy-owner-token');
    localStorage.setItem('business-site:client-user', 'legacy-client');
    localStorage.setItem('business-site:client-token', 'legacy-client-token');

    service.logout();

    const logoutRequest = httpMock.expectOne('/api/authentication/logout');
    expect(logoutRequest.request.method).toBe('POST');
    expect(logoutRequest.request.body).toEqual({});
    expect(logoutRequest.request.withCredentials).toBe(true);
    expect(logoutRequest.request.headers.get('x-ot-appscope')).toBe(
      'business-site'
    );
    expect(logoutRequest.request.headers.get('X-ot-session-mode')).toBe(
      'cookie'
    );

    logoutRequest.flush({ ok: true });

    expect(service.user()).toBeNull();
    expect(service.clientUser()).toBeNull();
    expect(service.authState()).toEqual({
      status: 'signed-out',
      identity: null,
      session: null,
      recovery: null,
    });
    expect(sessionStorage.getItem('business-site:session-kind')).toBeNull();
    expect(localStorage.getItem('business-site:user')).toBeNull();
    expect(localStorage.getItem('business-site:token')).toBeNull();
    expect(localStorage.getItem('business-site:client-user')).toBeNull();
    expect(localStorage.getItem('business-site:client-token')).toBeNull();
  });

  it('posts client logout even without a local token and stays signed out on server error', () => {
    localStorage.setItem('business-site:client-user', 'legacy-client');
    localStorage.setItem('business-site:client-token', 'legacy-client-token');
    sessionStorage.setItem('business-site:session-kind', 'client');

    service.logoutClient();

    const logoutRequest = httpMock.expectOne('/api/authentication/logout');
    expect(logoutRequest.request.method).toBe('POST');
    expect(logoutRequest.request.body).toEqual({});
    expect(logoutRequest.request.withCredentials).toBe(true);
    expect(logoutRequest.request.headers.get('x-ot-appscope')).toBe(
      'business-site'
    );
    expect(logoutRequest.request.headers.get('X-ot-session-mode')).toBe(
      'cookie'
    );

    logoutRequest.flush({}, { status: 500, statusText: 'Server Error' });

    expect(service.user()).toBeNull();
    expect(service.clientUser()).toBeNull();
    expect(service.authState()).toEqual({
      status: 'signed-out',
      identity: null,
      session: null,
      recovery: null,
    });
    expect(sessionStorage.getItem('business-site:session-kind')).toBeNull();
    expect(localStorage.getItem('business-site:user')).toBeNull();
    expect(localStorage.getItem('business-site:token')).toBeNull();
    expect(localStorage.getItem('business-site:client-user')).toBeNull();
    expect(localStorage.getItem('business-site:client-token')).toBeNull();
  });

  it('clears auth state synchronously before the cookie logout request completes', () => {
    service.loginAndExchange('owner@example.com', 'secret').subscribe();

    httpMock.expectOne('/api/authentication/login').flush({ data: {} });
    httpMock.expectOne('/api/authentication/session').flush({
      data: {
        userId: 'owner-1',
        profileId: 'profile-1',
        email: 'owner@example.com',
      },
    });

    service.logout();

    expect(service.user()).toBeNull();
    expect(service.clientUser()).toBeNull();
    expect(service.authState()).toEqual({
      status: 'signed-out',
      identity: null,
      session: null,
      recovery: null,
    });
    expect(sessionStorage.getItem('business-site:session-kind')).toBeNull();

    httpMock.expectOne('/api/authentication/logout').flush({ ok: true });
  });

  it('does not let a late restore response overwrite a newly established login', () => {
    sessionStorage.setItem('business-site:session-kind', 'client');
    service.restoreSession().subscribe();

    const restoreRequest = httpMock.expectOne('/api/authentication/session');

    service.logout();
    const logoutRequest = httpMock.expectOne('/api/authentication/logout');

    service.loginAndExchange('owner@example.com', 'secret').subscribe();
    httpMock.expectOne('/api/authentication/login').flush({ data: {} });

    const loginSessionRequest = httpMock.match(
      '/api/authentication/session'
    )[0];
    expect(loginSessionRequest).toBeDefined();

    loginSessionRequest.flush({
      data: {
        userId: 'owner-1',
        profileId: 'profile-1',
        email: 'owner@example.com',
      },
    });
    expect(service.user()).toEqual(
      expect.objectContaining({ userId: 'owner-1' })
    );

    restoreRequest.flush({
      data: {
        userId: 'stale-client-1',
        profileId: 'stale-client-profile',
        email: 'stale-client@example.com',
      },
    });
    expect(service.user()).toEqual(
      expect.objectContaining({ userId: 'owner-1' })
    );
    expect(service.clientUser()).toBeNull();
    expect(service.authState().session?.kind).toBe('owner');

    logoutRequest.flush({ ok: true });
  });
});
