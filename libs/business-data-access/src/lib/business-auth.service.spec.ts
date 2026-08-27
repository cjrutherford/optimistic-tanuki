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
});
