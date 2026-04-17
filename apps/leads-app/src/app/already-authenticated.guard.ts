import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { AuthStateService } from './auth-state.service';

export const alreadyAuthenticatedGuard: CanActivateFn = () => {
  const authState = inject(AuthStateService);
  const router = inject(Router);

  return authState.isAuthenticated$.pipe(
    take(1),
    map((isAuthenticated) =>
      isAuthenticated ? router.createUrlTree(['/']) : true
    )
  );
};
