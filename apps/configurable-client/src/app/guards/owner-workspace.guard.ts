import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { normalizeAuthReturnTo } from '@optimistic-tanuki/auth-ui';
import { AuthSessionService } from '../services/auth-session.service';

export const ownerWorkspaceGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthSessionService);
  const router = inject(Router);

  return (async () => {
    if (
      auth.isSignedIn ||
      (auth.status === 'loading' && (await auth.restoreSession()))
    ) {
      return true;
    }

    const currentOrigin =
      typeof window === 'undefined' ? '' : window.location.origin;
    const normalized = normalizeAuthReturnTo(state.url, { currentOrigin });
    const returnTo = normalized?.isCurrentOrigin ? normalized.path : '/owner';
    return router.createUrlTree(['/login'], { queryParams: { returnTo } });
  })();
};
