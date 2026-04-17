import {
  HttpEvent,
  HttpHandlerFn,
  HttpRequest,
  HttpResponse,
  withInterceptors,
} from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { AuthInterceptor } from './http.interceptor';
import { AuthStateService } from './state/auth-state.service';
import { financeAppScopeInterceptor } from './finance-appscope.interceptor';

describe('AuthInterceptor', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds the bearer token to authenticated requests', async () => {
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

    expect(forwardedRequest?.headers.get('Authorization')).toBe(
      'Bearer fin-token'
    );
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
});
