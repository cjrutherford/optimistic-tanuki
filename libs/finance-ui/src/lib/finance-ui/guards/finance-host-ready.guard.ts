import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { FINANCE_HOST_CONFIG } from '../tokens/finance-host-config.token';

export const financeHostReadyGuard: CanActivateFn = async () => {
  const hostConfig = inject(FINANCE_HOST_CONFIG);
  const router = inject(Router);
  const isReady = (await hostConfig.isReady?.()) ?? true;

  if (isReady) {
    return true;
  }

  if (hostConfig.redirectTo) {
    await router.navigateByUrl(hostConfig.redirectTo);
  }

  return false;
};
