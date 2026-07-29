import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthStateService } from './auth-state.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authState = inject(AuthStateService);
  const router = inject(Router);
  const headers: Record<string, string> = {
    'X-ot-appscope': 'leads-app',
    'X-ot-session-mode': 'cookie',
  };

  const clonedRequest = req.clone({
    setHeaders: headers,
    withCredentials: true,
  });

  return next(clonedRequest).pipe(
    catchError((error) => {
      if (error.status === 401 && authState.isAuthenticated) {
        authState.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
