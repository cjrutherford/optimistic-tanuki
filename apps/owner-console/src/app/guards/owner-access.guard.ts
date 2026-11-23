import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { HOME_PATH, findNavEntry } from '../owner-nav';
import { AuthService } from '../services/auth.service';
import { OwnerAccessService } from '../services/owner-access.service';

/**
 * UX-only gate for the console shell: an account without an owner role gets
 * the "no access" page, and a page whose nav entry needs a permission the owner
 * lacks sends them Home. The gateway enforces both on every request.
 */
export const ownerAccessGuard: CanActivateChildFn = (_route, state) => {
  const access = inject(OwnerAccessService);
  const router = inject(Router);

  return access.load().pipe(
    map((result) => {
      if (result.status === 'denied') {
        return router.createUrlTree(['/no-access']);
      }
      const leaf = findNavEntry(state.url)?.leaf;
      if (leaf?.requiredPermission && !access.can(leaf.requiredPermission)) {
        return router.createUrlTree([HOME_PATH]);
      }
      return true;
    })
  );
};

/** The no-access page is only for signed-in accounts; others go to sign-in. */
export const noAccessGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.status === 'signed-in' || auth.status === 'forbidden'
    ? true
    : router.createUrlTree(['/login']);
};
