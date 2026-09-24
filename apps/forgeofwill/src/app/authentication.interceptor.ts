import { catchError, throwError } from 'rxjs';

import { AuthStateService } from './auth-state.service';
import { HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { inject } from '@angular/core';

export const authenticationInterceptor: HttpInterceptorFn = (req, next) => {
  const authStateService = inject(AuthStateService);
  const router = inject(Router);
  const clonedRequest = req.clone({
    setHeaders: {
      'x-ot-appscope': 'forgeofwill',
      'X-ot-session-mode': 'cookie',
    },
    withCredentials: true,
  });

  return next(clonedRequest).pipe(
    catchError((error) => {
      // Cookie-session probes are expected to 401 before sign-in and while
      // an OAuth callback is still redeeming. AuthState handles those; a
      // global logout+redirect here turns one probe into a logout POST plus
      // a navigation that re-probes, feeding the session loop.
      const url = req.url || '';
      const isSessionProbe =
        url.includes('/authentication/session') ||
        url.includes('/oauth/callback/redeem');
      if (error.status === 401 && !isSessionProbe) {
        authStateService.logout();
        router.navigate(['/login']);
      }
      return throwError(error);
    })
  );
};
