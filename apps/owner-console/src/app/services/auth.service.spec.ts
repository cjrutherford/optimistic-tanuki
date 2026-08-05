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
        user: {
          userId: 'owner-1',
          profileId: 'profile-1',
          email: 'owner@example.com',
          name: 'Owner',
        },
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
