import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();
  const appScope = 'owner-console';

  req = req.clone({
    setHeaders: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-ot-appscope': appScope,
      'X-ot-session-mode': 'cookie',
    },
    withCredentials: true,
  });

  return next(req);
};
