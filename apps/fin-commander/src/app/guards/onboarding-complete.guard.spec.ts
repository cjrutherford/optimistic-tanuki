import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { FinanceService } from '@optimistic-tanuki/finance-ui';
import { onboardingCompleteGuard } from './onboarding-complete.guard';
import { TenantContextService } from '../tenant-context.service';
import { ProfileService } from '../profile.service';

describe('onboardingCompleteGuard', () => {
  it('redirects the new commander route until setup is complete', async () => {
    const redirectTree = { redirected: true };
    const createUrlTree = jest.fn().mockReturnValue(redirectTree);

    await TestBed.configureTestingModule({
      providers: [
        {
          provide: TenantContextService,
          useValue: {
            activeTenant: () => ({ id: 'tenant-1', name: 'North Household' }),
          },
        },
        {
          provide: ProfileService,
          useValue: {
            getCurrentUserProfile: () => ({ id: 'profile-1' }),
            getEffectiveProfile: () => ({ id: 'profile-1' }),
          },
        },
        {
          provide: FinanceService,
          useValue: {
            getOnboardingState: jest.fn().mockResolvedValue({
              requiresOnboarding: true,
              availableWorkspaces: [],
              checklist: [],
            }),
          },
        },
        {
          provide: Router,
          useValue: {
            createUrlTree,
          },
        },
      ],
    }).compileComponents();

    const result = await TestBed.runInInjectionContext(() =>
      onboardingCompleteGuard(
        {} as never,
        {
          url: '/commander/new/overview',
        } as never
      )
    );

    expect(result).toBe(redirectTree);
    expect(createUrlTree).toHaveBeenCalledWith(['/onboarding']);
  });

  it('hydrates tenant context before enforcing setup for the new commander route', async () => {
    const createUrlTree = jest.fn();
    const loadTenantContext = jest.fn().mockResolvedValue(undefined);
    const activeTenant = jest
      .fn()
      .mockReturnValueOnce(null)
      .mockReturnValue({
        id: 'tenant-1',
        name: 'North Household',
        type: 'household',
      });

    await TestBed.configureTestingModule({
      providers: [
        {
          provide: TenantContextService,
          useValue: {
            activeTenant,
            loadTenantContext,
          },
        },
        {
          provide: ProfileService,
          useValue: {
            getCurrentUserProfile: () => ({ id: 'profile-1' }),
            getEffectiveProfile: () => ({ id: 'profile-1' }),
          },
        },
        {
          provide: FinanceService,
          useValue: {
            getOnboardingState: jest.fn().mockResolvedValue({
              requiresOnboarding: false,
              availableWorkspaces: ['personal'],
              checklist: [{ id: 'create-budget', complete: true }],
            }),
          },
        },
        {
          provide: Router,
          useValue: {
            createUrlTree,
          },
        },
      ],
    }).compileComponents();

    const result = await TestBed.runInInjectionContext(() =>
      onboardingCompleteGuard(
        {} as never,
        {
          url: '/commander/new/overview',
        } as never
      )
    );

    expect(loadTenantContext).toHaveBeenCalled();
    expect(result).toBe(true);
    expect(createUrlTree).not.toHaveBeenCalled();
  });

  it('hydrates profile context before checking commander onboarding access', async () => {
    const createUrlTree = jest.fn();
    const getAllProfiles = jest.fn().mockResolvedValue(undefined);
    const getCurrentUserProfile = jest
      .fn()
      .mockReturnValueOnce(null)
      .mockReturnValue({ id: 'profile-1' });
    const getEffectiveProfile = jest
      .fn()
      .mockReturnValueOnce(null)
      .mockReturnValue({ id: 'profile-1' });

    await TestBed.configureTestingModule({
      providers: [
        {
          provide: TenantContextService,
          useValue: {
            activeTenant: () => ({
              id: 'tenant-1',
              name: 'North Household',
              type: 'household',
            }),
          },
        },
        {
          provide: ProfileService,
          useValue: {
            getAllProfiles,
            getCurrentUserProfile,
            getEffectiveProfile,
          },
        },
        {
          provide: FinanceService,
          useValue: {
            getOnboardingState: jest.fn().mockResolvedValue({
              requiresOnboarding: false,
              availableWorkspaces: ['personal'],
              checklist: [{ id: 'create-budget', complete: true }],
            }),
          },
        },
        {
          provide: Router,
          useValue: {
            createUrlTree,
          },
        },
      ],
    }).compileComponents();

    const result = await TestBed.runInInjectionContext(() =>
      onboardingCompleteGuard(
        {} as never,
        {
          url: '/commander/new/overview',
        } as never
      )
    );

    expect(getAllProfiles).toHaveBeenCalled();
    expect(getEffectiveProfile).toHaveBeenCalled();
    expect(result).toBe(true);
    expect(createUrlTree).not.toHaveBeenCalled();
  });

  it('still redirects existing commander routes until setup is complete', async () => {
    const redirectTree = { redirected: true };
    const createUrlTree = jest.fn().mockReturnValue(redirectTree);

    await TestBed.configureTestingModule({
      providers: [
        {
          provide: TenantContextService,
          useValue: {
            activeTenant: () => ({ id: 'tenant-1', name: 'North Household' }),
          },
        },
        {
          provide: ProfileService,
          useValue: {
            getCurrentUserProfile: () => ({ id: 'profile-1' }),
            getEffectiveProfile: () => ({ id: 'profile-1' }),
          },
        },
        {
          provide: FinanceService,
          useValue: {
            getOnboardingState: jest.fn().mockResolvedValue({
              requiresOnboarding: true,
              availableWorkspaces: [],
              checklist: [],
            }),
          },
        },
        {
          provide: Router,
          useValue: {
            createUrlTree,
          },
        },
      ],
    }).compileComponents();

    const result = await TestBed.runInInjectionContext(() =>
      onboardingCompleteGuard(
        {} as never,
        {
          url: '/commander/existing-plan/overview',
        } as never
      )
    );

    expect(result).toBe(redirectTree);
    expect(createUrlTree).toHaveBeenCalledWith(['/onboarding']);
  });
});
