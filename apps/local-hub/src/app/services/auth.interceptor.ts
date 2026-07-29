import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthStateService } from './auth-state.service';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authStateService = inject(AuthStateService);
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
