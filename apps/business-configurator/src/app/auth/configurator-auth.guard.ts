import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { CanActivateFn } from '@angular/router';
import { normalizeAuthReturnTo } from '@optimistic-tanuki/auth-ui';
import { AuthStateService } from '../state/auth-state.service';
import { ReturnIntentService } from '../state/return-intent.service';

const CONFIGURATOR_FALLBACK = '/';
const SERVER_ORIGIN = 'http://business-configurator.invalid';

function currentOrigin(): string {
  return typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : SERVER_ORIGIN;
}

export const configuratorAuthGuard: CanActivateFn = (_route, state) => {
  const authState = inject(AuthStateService);
  const router = inject(Router);
  const returnIntent = inject(ReturnIntentService);

  if (authState.isAuthenticated) {
    return true;
  }

  const returnTarget = normalizeAuthReturnTo(state.url, {
    currentOrigin: currentOrigin(),
  });
  returnIntent.remember(state.url);

  return router.createUrlTree(['/login'], {
    queryParams: {
      returnUrl: returnTarget?.isCurrentOrigin
        ? returnTarget.path
        : CONFIGURATOR_FALLBACK,
    },
  });
};
