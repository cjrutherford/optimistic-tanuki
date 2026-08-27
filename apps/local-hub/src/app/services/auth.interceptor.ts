import { HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { AuthStateService } from './auth-state.service';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);
  const router = inject(Router);
  const headers: Record<string, string> = {
    'X-ot-appscope': 'local-hub',
    'X-ot-session-mode': 'cookie',
  };

  const clonedRequest = req.clone({
    setHeaders: headers,
    withCredentials: true,
  });

  return next(clonedRequest).pipe(
    catchError((error) => {
      // Resolve auth state lazily. AuthStateService itself performs the
      // initial session request, so injecting it here eagerly creates a
      // circular dependency while that request is being constructed.
      const authStateService = injector.get(AuthStateService);
      if (error.status === 401 && authStateService.isAuthenticated) {
        // Only treat 401 as session expiry if a token was present.
        // Anonymous users hitting auth-required endpoints should NOT be
        // redirected to login.
        authStateService.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
