import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { FinanceService } from '@optimistic-tanuki/finance-ui';
import { TenantContextService } from '../tenant-context.service';
import { ProfileService } from '../profile.service';
import { resolveNextSetupRoute } from '../setup-route-policy';

function isOnboardingFinanceRoute(url: string): boolean {
  return /^\/tenants\/[^/]+\/accounts\/(personal|business)\/(accounts|transactions|budgets|recurring)(?:[/?#]|$)/.test(
    url
  );
}

export const onboardingCompleteGuard: CanActivateFn = async (_route, state) => {
  const tenantContext = inject(TenantContextService);
  const profileService = inject(ProfileService);
  const financeService = inject(FinanceService);
  const router = inject(Router);

  let profile =
    profileService.getCurrentUserProfile() ??
    profileService.getEffectiveProfile();

  if (!profile) {
    await profileService.getAllProfiles();
    profile =
      profileService.getCurrentUserProfile() ??
      profileService.getEffectiveProfile();
  }

  let activeTenant = tenantContext.activeTenant();

  if (profile && !activeTenant?.type) {
    await tenantContext.loadTenantContext();
    activeTenant = tenantContext.activeTenant();
  }

  const nextRoute = await resolveNextSetupRoute(
    profileService,
    tenantContext,
    financeService
  );

  if (nextRoute) {
    if (nextRoute[0] === '/onboarding' && isOnboardingFinanceRoute(state.url)) {
      return true;
    }

    return router.createUrlTree(nextRoute);
  }

  return true;
};
