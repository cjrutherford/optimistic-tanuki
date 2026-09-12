import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { normalizeAuthReturnTo } from '@optimistic-tanuki/auth-ui';
import { catchError, throwError } from 'rxjs';
import { AuthStateService } from '../state/auth-state.service';

const CONFIGURATOR_FALLBACK = '/';
const SERVER_ORIGIN = 'http://business-configurator.invalid';

function currentOrigin(): string {
  return typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : SERVER_ORIGIN;
}

function isAuthenticationRoute(url: string): boolean {
  try {
    const path =
      new URL(url, currentOrigin()).pathname.replace(/\/+$/, '') || '/';
    return (
      path === '/login' ||
      path === '/oauth/callback' ||
      path.startsWith('/oauth/callback/')
    );
  } catch {
    return false;
  }
}

export const authenticationInterceptor: HttpInterceptorFn = (req, next) => {
  const authState = inject(AuthStateService);
  const router = inject(Router);
  return next(
    req.clone({
      setHeaders: {
        ...(req.headers.has('X-ot-appscope')
          ? {}
          : { 'X-ot-appscope': 'business-configurator' }),
        'X-ot-session-mode': 'cookie',
      },
      withCredentials: true,
    })
  ).pipe(
    catchError((error) => {
      const isBootstrapSessionRequest = req.url.endsWith(
        '/authentication/session'
      );
      if (error.status === 401 && !isBootstrapSessionRequest) {
        const returnUrl =
          router.getCurrentNavigation()?.finalUrl?.toString() ?? router.url;
        const returnTarget = normalizeAuthReturnTo(returnUrl, {
          currentOrigin: currentOrigin(),
        });
        authState.markExpired(
          returnTarget?.isCurrentOrigin ? returnTarget.path : null
        );
        if (
          !isAuthenticationRoute(router.url) &&
          !isAuthenticationRoute(returnUrl)
        ) {
          void router.navigate(['/login'], {
            queryParams: {
              returnUrl: returnTarget?.isCurrentOrigin
                ? returnTarget.path
                : CONFIGURATOR_FALLBACK,
            },
          });
        }
      }
      return throwError(() => error);
    })
  );
};
