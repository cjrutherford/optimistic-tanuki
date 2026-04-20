import {
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';

export const financeAppScopeInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  if (!req.url.startsWith('/api')) {
    return next(req);
  }

  const activeTenantId =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('fin-commander-active-tenant-id')
      : null;
  const isTenantBootstrapRequest =
    req.url === '/api/finance/tenant/current' ||
    req.url === '/api/finance/onboarding/bootstrap';

  return next(
    req.clone({
      setHeaders: {
        'x-ot-appscope': 'finance',
        ...(req.url.startsWith('/api/finance') &&
        activeTenantId &&
        !isTenantBootstrapRequest
          ? { 'x-finance-tenant-id': activeTenantId }
          : {}),
      },
    }),
  );
};
