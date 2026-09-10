import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: { navigate: jest.fn() } },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('sends the owner-console app scope header on login', () => {
    service.login('owner@example.com', 'password').subscribe();

    const req = httpMock.expectOne('/api/authentication/login');
    expect(req.request.headers.get('x-ot-appscope')).toBe('owner-console');
    expect(req.request.headers.get('X-ot-session-mode')).toBe('cookie');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ data: {} });
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('restores browser authentication and session user from the cookie-backed session endpoint', () => {
    service.restoreSession().subscribe();

    const req = httpMock.expectOne('/api/authentication/session');
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({
      data: {
        userId: 'owner-1',
        profileId: 'profile-1',
        email: 'owner@example.com',
        name: 'Owner',
      },
    });

    expect(service.isAuthenticated()).toBe(true);
    expect(service.getSessionUser()).toEqual({
      userId: 'owner-1',
      profileId: 'profile-1',
      email: 'owner@example.com',
      name: 'Owner',
    });
  });

  it('restores the owner identity when the gateway returns the legacy nested session shape', () => {
    service.restoreSession().subscribe();

    const req = httpMock.expectOne('/api/authentication/session');
    req.flush({
      data: {
        user: {
          userId: 'owner-2',
          profileId: 'profile-2',
          email: 'owner@example.com',
        },
      },
    });

    expect(service.getSessionUser()).toEqual({
      userId: 'owner-2',
      profileId: 'profile-2',
      email: 'owner@example.com',
    });
    expect(service.isAuthenticated()).toBe(true);
  });

  it('reports an ordinary signed-out state when the initial session restore fails', () => {
    const restore = service.restoreSession();
    restore.subscribe((restored) => expect(restored).toBe(false));
    const req = httpMock.expectOne('/api/authentication/session');
    req.flush(null, { status: 401, statusText: 'Unauthenticated' });

    expect(service).toHaveProperty('status', 'signed-out');
    expect((service as unknown as { status: string }).status).toBe(
      'signed-out'
    );
    expect(service.isAuthenticated()).toBe(false);
  });

  it('reports an expired state when a previously restored session can no longer be restored', () => {
    service.restoreSession().subscribe();
    httpMock.expectOne('/api/authentication/session').flush({
      data: { userId: 'owner-1' },
    });

    service
      .restoreSession()
      .subscribe((restored) => expect(restored).toBe(false));
    httpMock
      .expectOne('/api/authentication/session')
      .flush(null, { status: 401, statusText: 'Expired' });

    expect(service).toHaveProperty('status', 'expired');
    expect((service as unknown as { status: string }).status).toBe('expired');
    expect(service.isAuthenticated()).toBe(false);
    expect(service.getSessionUser()).toBeNull();
  });

  it('clears the cookie-backed session on logout', () => {
    service.logout();

    const req = httpMock.expectOne('/api/authentication/logout');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ data: {} });
  });

  it('sends the owner-console app scope header on registration', () => {
    service
      .register('owner@example.com', 'Owner', 'Console', 'password', 'password')
      .subscribe();

    const req = httpMock.expectOne('/api/authentication/register');
    expect(req.request.headers.get('x-ot-appscope')).toBe('owner-console');
    expect(req.request.headers.get('X-ot-session-mode')).toBe('cookie');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ data: {} });
    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('auth_token')).toBeNull();
  });
});
