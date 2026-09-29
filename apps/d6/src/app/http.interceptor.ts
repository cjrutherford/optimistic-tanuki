import { HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { AuthStateService } from './services/auth-state.service';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const AuthInterceptor: HttpInterceptorFn = (req, next) => {
  // Resolved lazily: AuthStateService's constructor makes the session request,
  // which runs through this interceptor, so injecting it eagerly is circular.
  const injector = inject(Injector);
  const router = inject(Router);
  const appScope = 'D6';

  const clonedRequest = req.clone({
    setHeaders: {
      'X-ot-appscope': appScope,
      'X-ot-session-mode': 'cookie',
    },
    withCredentials: true,
  });

  return next(clonedRequest).pipe(
    catchError((error) => {
      if (error.status === 401) {
        injector.get(AuthStateService).logout();
        router.navigate(['/login']);
      }
      return throwError(error);
    })
  );
};
