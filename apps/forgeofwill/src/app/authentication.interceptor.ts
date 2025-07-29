import { catchError, throwError } from 'rxjs';

import { AuthStateService } from './auth-state.service';
import { HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { inject } from '@angular/core';

export const authenticationInterceptor: HttpInterceptorFn = (req, next) => {
   const authStateService = inject(AuthStateService);
  const router = inject(Router);
  const token = authStateService.getToken();
  console.log("🚀 ~ authenticationInterceptor ~ token:", token)

  const clonedRequest = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
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
