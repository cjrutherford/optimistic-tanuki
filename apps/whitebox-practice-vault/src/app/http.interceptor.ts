import { HttpInterceptorFn } from '@angular/common/http';

const STAFF_ROUTE_PATTERNS = [
  '/api/v1/vault/compliance/',
  '/api/v1/vault/copilot',
];

export const vaultStaffSessionInterceptor: HttpInterceptorFn = (req, next) => {
  if (!STAFF_ROUTE_PATTERNS.some((pattern) => req.url.startsWith(pattern))) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: {
        'X-ot-appscope': 'finance',
        'X-ot-session-mode': 'cookie',
      },
      withCredentials: true,
    })
  );
};
