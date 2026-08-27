import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthStateService } from '../state/auth-state.service';

export const authenticationInterceptor: HttpInterceptorFn = (req, next) => {
  const authState = inject(AuthStateService);
  const router = inject(Router);
  return next(
    req.clone({
      setHeaders: {
        'X-ot-appscope': 'business-configurator',
        'X-ot-session-mode': 'cookie',
      },
      withCredentials: true,
    })
  ).pipe(
    catchError((error) => {
      if (error.status === 401) {
        authState.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
