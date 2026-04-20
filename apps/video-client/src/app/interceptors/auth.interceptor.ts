import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { AuthStateService } from '../state/auth-state.service';
import { resolveServerApiUrl } from './server-api-url.util';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthStateService);
  const platformId = inject(PLATFORM_ID);
  const token = authService.getToken();

  req = req.clone({
    url: resolveServerApiUrl(req.url, isPlatformServer(platformId)),
  });

  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(req);
};
