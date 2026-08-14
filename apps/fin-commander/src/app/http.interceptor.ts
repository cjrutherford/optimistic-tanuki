import {
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';

export const AuthInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const clonedRequest = req.clone({
    setHeaders: {
      'X-ot-session-mode': 'cookie',
    },
    withCredentials: true,
  });

  return next(clonedRequest);
};
