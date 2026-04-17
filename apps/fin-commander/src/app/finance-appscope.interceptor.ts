import {
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';

export const financeAppScopeInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  if (!req.url.startsWith('/api')) {
    return next(req);
  }

  const activeTenantId =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('fin-commander-active-tenant-id')
      : null;

  return next(
    req.clone({
      setHeaders: {
        'x-ot-appscope': 'finance',
        ...(req.url.startsWith('/api/finance') && activeTenantId
          ? { 'x-finance-tenant-id': activeTenantId }
          : {}),
      },
    })
  );
};
