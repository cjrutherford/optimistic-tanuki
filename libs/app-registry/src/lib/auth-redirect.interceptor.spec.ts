import { HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { AuthRedirectService } from './auth-redirect.service';
import { authRedirectInterceptor } from './auth-redirect.interceptor';

describe('authRedirectInterceptor', () => {
  it('redirects to login on 401 responses', (done) => {
    const redirect = { redirectToLogin: jest.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: AuthRedirectService, useValue: redirect }],
    });
    const request = new HttpRequest('GET', '/api/protected');

    TestBed.runInInjectionContext(() => {
      authRedirectInterceptor(request, () =>
        throwError(() => new HttpErrorResponse({ status: 401 }))
      ).subscribe({
        error: () => {
          expect(redirect.redirectToLogin).toHaveBeenCalled();
          done();
        },
      });
    });
  });

  it('does not redirect for non-auth errors', (done) => {
    const redirect = { redirectToLogin: jest.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: AuthRedirectService, useValue: redirect }],
    });
    const request = new HttpRequest('GET', '/api/protected');

    TestBed.runInInjectionContext(() => {
      authRedirectInterceptor(request, () =>
        throwError(() => new HttpErrorResponse({ status: 500 }))
      ).subscribe({
        error: () => {
          expect(redirect.redirectToLogin).not.toHaveBeenCalled();
          done();
        },
      });
    });
  });
});
