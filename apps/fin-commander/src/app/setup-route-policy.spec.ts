import { resolveNextSetupRoute } from './setup-route-policy';

describe('resolveNextSetupRoute', () => {
  it('keeps users in onboarding until the active finance tenant has a type', async () => {
    const profileService = {
      getCurrentUserProfile: () => ({ id: 'profile-1' }),
      getEffectiveProfile: () => ({ id: 'profile-1' }),
    };
    const tenantContext = {
      activeTenant: () => ({
        id: 'tenant-1',
        name: 'Primary Finance Workspace',
        appScope: 'finance',
      }),
    };
    const financeService = {
      getOnboardingState: jest.fn(),
    };

    await expect(
      resolveNextSetupRoute(
        profileService as never,
        tenantContext as never,
        financeService as never
      )
    ).resolves.toEqual(['/onboarding']);
    expect(financeService.getOnboardingState).not.toHaveBeenCalled();
  });

  it('allows navigation when the tenant is typed and finance setup is complete', async () => {
    const profileService = {
      getCurrentUserProfile: () => ({ id: 'profile-1' }),
      getEffectiveProfile: () => ({ id: 'profile-1' }),
    };
    const tenantContext = {
      activeTenant: () => ({
        id: 'tenant-1',
        name: 'North Household',
        appScope: 'finance',
        type: 'household',
      }),
    };
    const financeService = {
      getOnboardingState: jest.fn().mockResolvedValue({
        requiresOnboarding: false,
        availableWorkspaces: ['personal'],
        checklist: [{ id: 'create-budget', complete: true }],
      }),
    };

    await expect(
      resolveNextSetupRoute(
        profileService as never,
        tenantContext as never,
        financeService as never
      )
    ).resolves.toBeNull();
  });

  it('does not block on optional workspace checklist items once at least one workspace exists', async () => {
    const profileService = {
      getCurrentUserProfile: () => ({ id: 'profile-1' }),
      getEffectiveProfile: () => ({ id: 'profile-1' }),
    };
    const tenantContext = {
      activeTenant: () => ({
        id: 'tenant-1',
        name: 'North Household',
        appScope: 'finance',
        type: 'household',
      }),
    };
    const financeService = {
      getOnboardingState: jest.fn().mockResolvedValue({
        requiresOnboarding: false,
        availableWorkspaces: ['personal'],
        checklist: [
          { id: 'setup-business', complete: false },
          { id: 'create-budget', complete: true },
          { id: 'categorize-transactions', complete: true },
        ],
      }),
    };

    await expect(
      resolveNextSetupRoute(
        profileService as never,
        tenantContext as never,
        financeService as never
      )
    ).resolves.toBeNull();
  });
});
