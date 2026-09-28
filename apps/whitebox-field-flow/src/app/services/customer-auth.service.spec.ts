import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { CustomerAuthService } from './customer-auth.service';

const sessionUser = {
  userId: 'user-1',
  email: 'john@example.com',
  name: 'John Miller',
};

describe('CustomerAuthService', () => {
  let service: CustomerAuthService;
  let httpMock: HttpTestingController;

  const flushInitialSession = (status = 401): void => {
    const request = httpMock.expectOne('/api/authentication/session');
    request.flush(null, {
      status,
      statusText: status === 401 ? 'Unauthorized' : 'Error',
    });
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        CustomerAuthService,
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    service = TestBed.inject(CustomerAuthService);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.clear();
    flushInitialSession();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('restores only a complete server identity from the cookie session', () => {
    const restoreSession = (
      service as unknown as { restoreSession: () => void }
    ).restoreSession;

    restoreSession.call(service);
    httpMock
      .expectOne('/api/authentication/session')
      .flush({ data: { userId: 'user-1' } });
    expect(service.currentUser()).toBeNull();

    restoreSession.call(service);
    const request = httpMock.expectOne('/api/authentication/session');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ data: sessionUser });

    expect(service.currentUser()).toEqual(sessionUser);
    expect(localStorage.length).toBe(0);
  });

  it('registers through the cookie session and never synthesizes identity', () => {
    let result: { success: boolean; user: typeof sessionUser } | undefined;
    service
      .register({
        name: 'John Miller',
        email: 'john@example.com',
        password: 'password123',
      })
      .subscribe((value) => (result = value));

    const registerRequest = httpMock.expectOne('/api/authentication/register');
    expect(registerRequest.request.withCredentials).toBe(true);
    expect(registerRequest.request.body).toEqual({
      fn: 'John',
      ln: 'Miller',
      email: 'john@example.com',
      password: 'password123',
      confirm: 'password123',
      bio: '',
    });
    registerRequest.flush({ data: { user: { id: 'user-1' } } });

    const sessionRequest = httpMock.expectOne('/api/authentication/session');
    expect(sessionRequest.request.withCredentials).toBe(true);
    sessionRequest.flush({ data: sessionUser });

    expect(result).toEqual({
      success: true,
      user: sessionUser,
      verificationRequired: false,
    });
    expect(service.currentUser()).toEqual(sessionUser);
    expect(localStorage.length).toBe(0);
  });

  it('does not claim a session when registration requires email verification', () => {
    let result:
      | {
          success: boolean;
          user: typeof sessionUser | null;
          verificationRequired: boolean;
        }
      | undefined;
    service
      .register({
        name: 'John Miller',
        email: 'john@example.com',
        password: 'password123',
      })
      .subscribe((value) => (result = value));

    httpMock
      .expectOne('/api/authentication/register')
      .flush({ data: { verificationPending: true } });

    expect(result).toEqual({
      success: true,
      user: null,
      verificationRequired: true,
    });
    expect(service.currentUser()).toBeNull();
    httpMock.expectNone('/api/authentication/session');
  });

  it('logs in through the cookie session and never stores a token', () => {
    let result: { success: boolean; user: typeof sessionUser } | undefined;
    service
      .login({ email: 'john@example.com', password: 'password123' })
      .subscribe((value) => (result = value));

    const loginRequest = httpMock.expectOne('/api/authentication/login');
    expect(loginRequest.request.withCredentials).toBe(true);
    loginRequest.flush({ data: { token: 'server-only-token' } });

    httpMock
      .expectOne('/api/authentication/session')
      .flush({ data: sessionUser });

    expect(result).toEqual({ success: true, user: sessionUser });
    expect(service.currentUser()).toEqual(sessionUser);
    expect(JSON.stringify(service.currentUser())).not.toContain(
      'server-only-token'
    );
    expect(localStorage.length).toBe(0);
  });

  it('propagates registration failures without starting a session request', () => {
    let error: unknown;
    service
      .register({
        name: 'John Miller',
        email: 'john@example.com',
        password: 'password123',
      })
      .subscribe({ error: (value: unknown) => (error = value) });

    httpMock
      .expectOne('/api/authentication/register')
      .flush('registration rejected', {
        status: 401,
        statusText: 'Unauthorized',
      });

    expect(error).toBeDefined();
    expect(service.currentUser()).toBeNull();
    httpMock.expectNone('/api/authentication/session');
    expect(localStorage.length).toBe(0);
  });

  it('propagates login failures without starting a session request', () => {
    let error: unknown;
    service
      .login({ email: 'john@example.com', password: 'password123' })
      .subscribe({ error: (value: unknown) => (error = value) });

    httpMock
      .expectOne('/api/authentication/login')
      .flush('login rejected', { status: 401, statusText: 'Unauthorized' });

    expect(error).toBeDefined();
    expect(service.currentUser()).toBeNull();
    httpMock.expectNone('/api/authentication/session');
    expect(localStorage.length).toBe(0);
  });

  it('calls the cookie logout endpoint and clears local identity', () => {
    service.currentUser.set(sessionUser);
    const logout = (
      service as unknown as {
        logout: () => { subscribe: (observer: { next: () => void }) => void };
      }
    ).logout;

    logout.call(service).subscribe({ next: () => undefined });
    const request = httpMock.expectOne('/api/authentication/logout');
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toEqual({});
    request.flush({ success: true });

    expect(service.currentUser()).toBeNull();
    expect(localStorage.length).toBe(0);
  });
});
