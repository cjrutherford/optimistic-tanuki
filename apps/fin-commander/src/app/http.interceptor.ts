import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, Observable, throwError } from 'rxjs';
import { AuthStateService } from './state/auth-state.service';

export const AuthInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const authStateService = inject(AuthStateService);
  const router = inject(Router);
  const token = authStateService.getToken();

  const clonedRequest = req.clone({
    setHeaders: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {},
  });

  return next(clonedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        authStateService.logout();
        void router.navigate(['/login']);
      }

      return throwError(() => error);
    })
  );
};
