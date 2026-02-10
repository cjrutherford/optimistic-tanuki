import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthStateService } from './services/auth-state.service';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const AuthInterceptor: HttpInterceptorFn = (req, next) => {
  const authStateService = inject(AuthStateService);
  const router = inject(Router);
  const token = authStateService.getToken();

  const appScope = 'd6';

  const clonedRequest = req.clone({
    setHeaders: {
      Authorization: token ? `Bearer ${token}` : '',
      'X-ot-appscope': appScope,
    },
  });

  return next(clonedRequest).pipe(
    catchError((error) => {
      if (error.status === 401) {
        authStateService.logout();
        router.navigate(['/login']);
      }
      return throwError(error);
    })
  );
};
