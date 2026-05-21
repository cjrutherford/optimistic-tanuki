import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { BusinessAuthService } from './business-auth.service';

const BUSINESS_SITE_SCOPE = 'business-site';

export const businessHttpInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')) {
    return next(request);
  }

  const auth = inject(BusinessAuthService);
  const ownerToken = auth.token();
  const clientToken = auth.clientToken();
  const prefersOwnerToken =
    request.url.startsWith('/api/business/owner/') ||
    request.url === '/api/business/site-config';
  const token = prefersOwnerToken
    ? ownerToken ?? clientToken
    : clientToken ?? ownerToken;
  let headers = request.headers;

  if (!headers.has('x-ot-appscope')) {
    headers = headers.set('x-ot-appscope', BUSINESS_SITE_SCOPE);
  }

  if (token && !headers.has('Authorization')) {
    headers = headers.set('Authorization', `Bearer ${token}`);
  }

  return next(request.clone({ headers }));
};
