import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthStateService } from '../state/auth-state.service';

export const authenticationInterceptor: HttpInterceptorFn = (req, next) => {
  const authState = inject(AuthStateService);
  const router = inject(Router);
  const clonedRequest = req.clone({
    setHeaders: {
      // Owner-only hardware endpoints require the caller's explicit
      // Owner Console scope. All ordinary configurator requests keep their
      // application scope.
      'X-ot-appscope':
        req.headers.get('X-ot-appscope') ?? 'system-configurator',
      'X-ot-session-mode': 'cookie',
    },
    withCredentials: true,
  });

  return next(clonedRequest).pipe(
    catchError((error) => {
      if (error.status === 401) {
        authState.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
