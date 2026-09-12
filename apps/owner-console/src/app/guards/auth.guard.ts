import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { normalizeAuthReturnTo } from '@optimistic-tanuki/auth-ui';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  const currentOrigin =
    typeof window === 'undefined' ? '' : window.location.origin;
  const normalizedReturnTo = normalizeAuthReturnTo(state.url, {
    currentOrigin,
  });
  const returnUrl = normalizedReturnTo?.isCurrentOrigin
    ? normalizedReturnTo.path
    : '/dashboard';

  return router.createUrlTree(['/login'], { queryParams: { returnUrl } });
};
