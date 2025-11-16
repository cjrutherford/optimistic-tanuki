import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();
  const appScope = 'owner-console';

  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
        'X-ot-appscope': appScope,
      },
    });
  } else {
    req = req.clone({
      setHeaders: {
        'X-ot-appscope': appScope,
      },
    });
  }

  return next(req);
};
