import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { BusinessAuthService } from '@optimistic-tanuki/business-data-access';

export const clientAuthGuard: CanActivateFn = () => {
  const auth = inject(BusinessAuthService);
  const router = inject(Router);
  if (auth.isClientAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/client/login']);
};
