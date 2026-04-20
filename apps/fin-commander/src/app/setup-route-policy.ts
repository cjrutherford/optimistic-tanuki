import {
  FinanceOnboardingState,
  FinanceService,
  FinanceWorkspace,
} from '@optimistic-tanuki/finance-ui';
import { ProfileService } from './profile.service';
import { TenantContextService } from './tenant-context.service';

export type SetupRoute =
  | ['/settings']
  | ['/onboarding']
  | ['/finance', FinanceWorkspace, 'setup'];

function getSetupWorkspace(state: FinanceOnboardingState): FinanceWorkspace {
  return (
    state.availableWorkspaces.find((workspace) => workspace !== 'net-worth') ??
    'personal'
  );
}

function needsFinanceSetup(state: FinanceOnboardingState): boolean {
  return (
    state.checklist.length === 0 ||
    state.checklist.some((item) => !item.complete)
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

  if (!tenantContext.activeTenant()) {
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
    return ['/finance', getSetupWorkspace(onboardingState), 'setup'];
  }

  return null;
}
