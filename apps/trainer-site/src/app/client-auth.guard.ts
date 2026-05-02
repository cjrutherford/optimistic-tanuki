import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TrainerAuthService } from '@optimistic-tanuki/trainer-data-access';

export const clientAuthGuard: CanActivateFn = () => {
  const auth = inject(TrainerAuthService);
  const router = inject(Router);
  if (auth.isClientAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/client/login']);
};
