import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { BusinessAuthService } from './business-auth.service';

const BUSINESS_SITE_SCOPE = 'business-site';

export const businessHttpInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')) {
    return next(request);
  }

  const auth = inject(BusinessAuthService);
  let headers = request.headers;

  if (!headers.has('x-ot-appscope')) {
    headers = headers.set('x-ot-appscope', BUSINESS_SITE_SCOPE);
  }

  if (!headers.has('X-ot-session-mode')) {
    headers = headers.set('X-ot-session-mode', 'cookie');
  }

  return next(request.clone({ headers, withCredentials: true }));
};
