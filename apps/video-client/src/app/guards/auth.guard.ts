import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, CanActivateFn } from '@angular/router';
import { AuthStateService } from '../state/auth-state.service';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthStateService);
  const router = inject(Router);

  // The session cookie is only readable from the browser; the server render
  // cannot tell, so let it through and let the browser's navigation decide.
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return true;
  }

  await authService.ensureSession();
  if (authService.isAuthenticated) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
