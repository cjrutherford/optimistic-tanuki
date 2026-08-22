import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Carries the ot_session cookie to the gateway.
 *
 * Unlike the other clients this one does not redirect on 401. Reading a lesson
 * is open to anonymous visitors, so only the save controls care about a
 * session, and the components handle that themselves.
 */
export const LearningInterceptor: HttpInterceptorFn = (req, next) =>
  next(
    req.clone({
      setHeaders: {
        'X-ot-appscope': 'Learning',
        'X-ot-session-mode': 'cookie',
      },
      withCredentials: true,
    })
  );
