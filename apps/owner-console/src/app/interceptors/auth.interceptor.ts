import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const appScope = 'owner-console';

  req = req.clone({
    setHeaders: {
      'X-ot-appscope': appScope,
      'X-ot-session-mode': 'cookie',
    },
    withCredentials: true,
  });

  return next(req);
};
