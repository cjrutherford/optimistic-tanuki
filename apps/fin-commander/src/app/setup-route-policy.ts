import {
  FinanceOnboardingState,
  FinanceService,
} from '@optimistic-tanuki/finance-ui';
import { ProfileService } from './profile.service';
import { TenantContextService } from './tenant-context.service';

export type SetupRoute =
  | ['/settings']
  | ['/onboarding'];

function hasCompleteTenant(
  tenant: Pick<NonNullable<ReturnType<TenantContextService['activeTenant']>>, 'type'> | null
): boolean {
  return Boolean(tenant?.type);
}

function needsFinanceSetup(state: FinanceOnboardingState): boolean {
  const blockingChecklist = state.checklist.filter(
    (item) => !item.id.startsWith('setup-')
  );

  return (
    state.checklist.length === 0 ||
    blockingChecklist.some((item) => !item.complete)
  );
}

export async function resolveNextSetupRoute(
  profileService: Pick<
    ProfileService,
    'getCurrentUserProfile' | 'getEffectiveProfile'
  >,
  tenantContext: Pick<TenantContextService, 'activeTenant'>,
  financeService: Pick<FinanceService, 'getOnboardingState'>
): Promise<SetupRoute | null> {
  const profile =
    profileService.getCurrentUserProfile() ??
    profileService.getEffectiveProfile();

  if (!profile) {
    return ['/settings'];
  }

  if (!hasCompleteTenant(tenantContext.activeTenant())) {
    return ['/onboarding'];
  }

  const onboardingState = await financeService.getOnboardingState();

  if (
    onboardingState.requiresOnboarding ||
    onboardingState.availableWorkspaces.length === 0
  ) {
    return ['/onboarding'];
  }

  if (needsFinanceSetup(onboardingState)) {
    return ['/onboarding'];
  }

  return null;
}
