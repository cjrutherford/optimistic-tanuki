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
  // "social" app scope, blogging uses "blogging", etc.).
  let appScope = 'client-interface';
  const url = req.url || '';

  if (url.includes('/api/social')) {
    appScope = 'social';
  } else if (url.includes('/api/blog')) {
    appScope = 'blogging';
  } else if (url.includes('/api/project')) {
    appScope = 'project-planning';
  } else if (url.includes('/api/forum')) {
    appScope = 'forum';
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
