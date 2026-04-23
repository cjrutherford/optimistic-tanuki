import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthRedirectService } from './auth-redirect.service';

export const authRedirectInterceptor: HttpInterceptorFn = (req, next) => {
  const redirect = inject(AuthRedirectService);

  return next(req).pipe(
    catchError((error) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        redirect.redirectToLogin();
      }

      return throwError(() => error);
    })
  );
};
