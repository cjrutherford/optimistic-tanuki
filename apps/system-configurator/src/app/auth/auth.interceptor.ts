import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthStateService } from '../state/auth-state.service';

export const authenticationInterceptor: HttpInterceptorFn = (req, next) => {
  const authState = inject(AuthStateService);
  const router = inject(Router);
  const token = authState.getToken();

  const clonedRequest = req.clone({
    setHeaders: {
      Authorization: token ? `Bearer ${token}` : '',
      'X-ot-appscope': 'system-configurator',
    },
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
