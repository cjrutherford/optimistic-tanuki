import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthStateService } from '../state/auth-state.service';
import { authenticationInterceptor } from './auth.interceptor';

describe('authenticationInterceptor', () => {
  it('preserves a product scope explicitly selected by a shared data-access client', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authenticationInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthStateService, useValue: { logout: jest.fn() } },
      ],
    });
    const http = TestBed.inject(HttpClient);
    const httpMock = TestBed.inject(HttpTestingController);

    http
      .post(
        '/api/workspaces/business-sites/provision',
        {},
        {
          headers: { 'X-ot-appscope': 'business-site' },
        }
      )
      .subscribe();

    const request = httpMock.expectOne(
      '/api/workspaces/business-sites/provision'
    );
    expect(request.request.headers.get('X-ot-appscope')).toBe('business-site');
    expect(request.request.headers.get('X-ot-session-mode')).toBe('cookie');
    request.flush({});
    httpMock.verify();
  });

  it('preserves the in-flight deep link when an initial workspace request is unauthorized', () => {
    const authState = { markExpired: jest.fn() };
    const router = {
      url: '/',
      getCurrentNavigation: jest.fn(() => ({
        finalUrl: {
          toString: () => '/workspaces/workspace-1/sites/north-star',
        },
      })),
      navigate: jest.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        provideHttpClient(withInterceptors([authenticationInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthStateService, useValue: authState },
      ],
    });
    const http = TestBed.inject(HttpClient);
    const httpMock = TestBed.inject(HttpTestingController);

    http.get('/api/workspaces').subscribe({ error: () => undefined });
    httpMock
      .expectOne('/api/workspaces')
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: {
        returnUrl: '/workspaces/workspace-1/sites/north-star',
      },
    });
    expect(authState.markExpired).toHaveBeenCalledWith(
      '/workspaces/workspace-1/sites/north-star'
    );
    httpMock.verify();
  });

  it('leaves an expected bootstrap session 401 to restoreSession instead of redirecting early', () => {
    const authState = { markExpired: jest.fn() };
    const router = { url: '/', navigate: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        provideHttpClient(withInterceptors([authenticationInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthStateService, useValue: authState },
      ],
    });
    const http = TestBed.inject(HttpClient);
    const httpMock = TestBed.inject(HttpTestingController);

    http
      .get('/api/authentication/session')
      .subscribe({ error: () => undefined });
    httpMock
      .expectOne('/api/authentication/session')
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(authState.markExpired).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    httpMock.verify();
  });

  it.each([
    '/login',
    '/login?returnUrl=/workspaces/workspace-1/sites/north-star',
    '/oauth/callback',
  ])('does not redirect again from an auth route: %s', (url) => {
    const authState = { markExpired: jest.fn() };
    const router = {
      url,
      getCurrentNavigation: jest.fn(() => null),
      navigate: jest.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        provideHttpClient(withInterceptors([authenticationInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthStateService, useValue: authState },
      ],
    });
    const http = TestBed.inject(HttpClient);
    const httpMock = TestBed.inject(HttpTestingController);

    http.get('/api/workspaces').subscribe({ error: () => undefined });
    httpMock.expectOne('/api/workspaces').flush(
      {},
      {
        status: 401,
        statusText: 'Unauthorized',
      }
    );

    expect(authState.markExpired).toHaveBeenCalledWith(null);
    expect(router.navigate).not.toHaveBeenCalled();
    httpMock.verify();
  });

  it.each([
    'https://evil.example/phish',
    '//evil.example/phish',
    '/workspaces/workspace-1/sites/north-star\nalert(1)',
  ])('uses the configurator root for an unsafe return target: %s', (url) => {
    const authState = { markExpired: jest.fn() };
    const router = {
      url,
      getCurrentNavigation: jest.fn(() => null),
      navigate: jest.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        provideHttpClient(withInterceptors([authenticationInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthStateService, useValue: authState },
      ],
    });
    const http = TestBed.inject(HttpClient);
    const httpMock = TestBed.inject(HttpTestingController);

    http.get('/api/workspaces').subscribe({ error: () => undefined });
    httpMock.expectOne('/api/workspaces').flush(
      {},
      {
        status: 401,
        statusText: 'Unauthorized',
      }
    );

    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/' },
    });
    expect(authState.markExpired).toHaveBeenCalledWith(null);
    httpMock.verify();
  });
});
