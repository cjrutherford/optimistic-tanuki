import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthStateService } from './auth-state.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authState = inject(AuthStateService);
  const router = inject(Router);
  const token = authState.getToken();

  const clonedRequest = req.clone({
    setHeaders: {
      Authorization: token ? `Bearer ${token}` : '',
      'X-ot-appscope': 'leads-app',
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
