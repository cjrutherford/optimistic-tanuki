import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthStateService } from './state/auth-state.service';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const AuthInterceptor: HttpInterceptorFn = (req, next) => {
  const authStateService = inject(AuthStateService);
  const router = inject(Router);
  const token = authStateService.getToken();

  // Determine app scope based on API route to align with
  // permissions configuration (social endpoints use the
  // "social" app scope, while general client-interface
  // traffic uses the "client-interface" scope).
  let appScope = 'client-interface';
  const url = req.url || '';

  if (url.includes('/api/social')) {
    appScope = 'social';
  }

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
