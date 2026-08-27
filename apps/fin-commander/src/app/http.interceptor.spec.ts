import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpRequest,
  HttpResponse,
  withInterceptors,
} from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';
import { AuthInterceptor } from './http.interceptor';
import { AuthStateService } from './state/auth-state.service';
import { financeAppScopeInterceptor } from './finance-appscope.interceptor';

describe('AuthInterceptor', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses the cookie session for authenticated requests', async () => {
    let forwardedRequest: HttpRequest<unknown> | undefined;

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthStateService,
          useValue: {
            getToken: () => 'fin-token',
            logout: jest.fn(),
          },
        },
      ],
    });

    await TestBed.runInInjectionContext(async () => {
      const request = new HttpRequest('GET', '/api/finance/personal');
      const next: HttpHandlerFn = (req): ReturnType<HttpHandlerFn> => {
        forwardedRequest = req;
        return of(
          new HttpResponse({ status: 200, url: req.url })
        ) as ReturnType<HttpHandlerFn>;
      };

      await firstValueFrom(AuthInterceptor(request, next));
    });

    expect(forwardedRequest?.headers.get('Authorization')).toBeNull();
    expect(forwardedRequest?.headers.get('X-ot-session-mode')).toBe('cookie');
    expect(forwardedRequest?.withCredentials).toBe(true);
  });

  it('does not log out or redirect when an anonymous session restore receives 401', async () => {
    const logout = jest.fn();
    const navigate = jest.fn();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Router, useValue: { navigate } },
        {
          provide: AuthStateService,
          useValue: { isAuthenticated: false, logout },
        },
      ],
    });

    await TestBed.runInInjectionContext(async () => {
      const request = new HttpRequest('GET', '/api/authentication/session');
      const next: HttpHandlerFn = () =>
        throwError(
          () => new HttpErrorResponse({ status: 401, url: request.url })
        ) as ReturnType<HttpHandlerFn>;

      await expect(
        firstValueFrom(AuthInterceptor(request, next))
      ).rejects.toMatchObject({
        status: 401,
      });
    });

    expect(logout).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('adds the finance app scope header to finance api requests', async () => {
    let forwardedRequest: HttpRequest<unknown> | undefined;

    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });

    await TestBed.runInInjectionContext(async () => {
      const request = new HttpRequest('GET', '/api/finance/accounts');
      const next: HttpHandlerFn = (req): ReturnType<HttpHandlerFn> => {
        forwardedRequest = req;
        return of(
          new HttpResponse({ status: 200, url: req.url })
        ) as ReturnType<HttpHandlerFn>;
      };

      await firstValueFrom(financeAppScopeInterceptor(request, next));
    });

    expect(forwardedRequest?.headers.get('x-ot-appscope')).toBe('finance');
  });

  it('adds the finance app scope header to non-finance api requests', async () => {
    let forwardedRequest: HttpRequest<unknown> | undefined;

    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });

    await TestBed.runInInjectionContext(async () => {
      const request = new HttpRequest('POST', '/api/authentication/login', {});
      const next: HttpHandlerFn = (req): ReturnType<HttpHandlerFn> => {
        forwardedRequest = req;
        return of(
          new HttpResponse({ status: 200, url: req.url })
        ) as ReturnType<HttpHandlerFn>;
      };

      await firstValueFrom(financeAppScopeInterceptor(request, next));
    });

    expect(forwardedRequest?.headers.get('x-ot-appscope')).toBe('finance');
    expect(forwardedRequest?.headers.has('x-finance-tenant-id')).toBe(false);
  });

  it('adds the selected finance tenant header to finance api requests', async () => {
    let forwardedRequest: HttpRequest<unknown> | undefined;
    localStorage.setItem('fin-commander-active-tenant-id', 'tenant-42');

    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });

    await TestBed.runInInjectionContext(async () => {
      const request = new HttpRequest('GET', '/api/finance/accounts');
      const next: HttpHandlerFn = (req): ReturnType<HttpHandlerFn> => {
        forwardedRequest = req;
        return of(
          new HttpResponse({ status: 200, url: req.url })
        ) as ReturnType<HttpHandlerFn>;
      };

      await firstValueFrom(financeAppScopeInterceptor(request, next));
    });

    expect(forwardedRequest?.headers.get('x-finance-tenant-id')).toBe(
      'tenant-42'
    );
  });

  it('does not send a stale finance tenant header for tenant bootstrap requests', async () => {
    let forwardedRequest: HttpRequest<unknown> | undefined;
    localStorage.setItem('fin-commander-active-tenant-id', 'tenant-42');

    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });

    await TestBed.runInInjectionContext(async () => {
      const request = new HttpRequest('GET', '/api/finance/tenant/current');
      const next: HttpHandlerFn = (req): ReturnType<HttpHandlerFn> => {
        forwardedRequest = req;
        return of(
          new HttpResponse({ status: 200, url: req.url })
        ) as ReturnType<HttpHandlerFn>;
      };

      await firstValueFrom(financeAppScopeInterceptor(request, next));
    });

    expect(forwardedRequest?.headers.get('x-ot-appscope')).toBe('finance');
    expect(forwardedRequest?.headers.has('x-finance-tenant-id')).toBe(false);
  });

  it('keeps the selected finance tenant header for tenant member requests', async () => {
    let forwardedRequest: HttpRequest<unknown> | undefined;
    localStorage.setItem('fin-commander-active-tenant-id', 'tenant-42');

    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });

    await TestBed.runInInjectionContext(async () => {
      const request = new HttpRequest('GET', '/api/finance/tenant/members');
      const next: HttpHandlerFn = (req): ReturnType<HttpHandlerFn> => {
        forwardedRequest = req;
        return of(
          new HttpResponse({ status: 200, url: req.url })
        ) as ReturnType<HttpHandlerFn>;
      };

      await firstValueFrom(financeAppScopeInterceptor(request, next));
    });

    expect(forwardedRequest?.headers.get('x-finance-tenant-id')).toBe(
      'tenant-42'
    );
  });

  it('does not send a stale finance tenant header for onboarding bootstrap requests', async () => {
    let forwardedRequest: HttpRequest<unknown> | undefined;
    localStorage.setItem('fin-commander-active-tenant-id', 'tenant-42');

    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });

    await TestBed.runInInjectionContext(async () => {
      const request = new HttpRequest(
        'POST',
        '/api/finance/onboarding/bootstrap',
        {}
      );
      const next: HttpHandlerFn = (req): ReturnType<HttpHandlerFn> => {
        forwardedRequest = req;
        return of(
          new HttpResponse({ status: 200, url: req.url })
        ) as ReturnType<HttpHandlerFn>;
      };

      await firstValueFrom(financeAppScopeInterceptor(request, next));
    });

    expect(forwardedRequest?.headers.get('x-ot-appscope')).toBe('finance');
    expect(forwardedRequest?.headers.has('x-finance-tenant-id')).toBe(false);
  });
});
