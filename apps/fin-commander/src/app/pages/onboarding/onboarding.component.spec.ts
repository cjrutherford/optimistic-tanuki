import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { FinanceService } from '@optimistic-tanuki/finance-ui';
import { OnboardingComponent } from './onboarding.component';
import { TenantContextService } from '../../tenant-context.service';

describe('OnboardingComponent', () => {
  const financeService = {
    bootstrapWorkspaces: jest.fn(),
    getOnboardingState: jest.fn(),
  };
  const tenantContext = {
    createTenant: jest.fn(),
    loadTenantContext: jest.fn().mockResolvedValue(undefined),
    activeTenant: jest.fn(),
    selectTenant: jest.fn(),
  };
  const router = {
    navigate: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    financeService.getOnboardingState.mockResolvedValue({
      requiresOnboarding: false,
      availableWorkspaces: ['business'],
      checklist: [
        { id: 'categorize-transactions', complete: false },
        { id: 'create-budget', complete: false },
      ],
    });
    tenantContext.activeTenant.mockReturnValue(null);

    await TestBed.configureTestingModule({
      imports: [OnboardingComponent],
      providers: [
        { provide: FinanceService, useValue: financeService },
        { provide: TenantContextService, useValue: tenantContext },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();
  });

  it('creates the account first and only advances to workspace selection', async () => {
    tenantContext.createTenant.mockResolvedValue({
      id: 'tenant-1',
      name: 'Household',
      profileId: 'profile-1',
      appScope: 'finance',
      type: 'household',
    });

    const fixture = TestBed.createComponent(OnboardingComponent);
    fixture.componentInstance.accountNameValue = 'Household';
    fixture.componentInstance.accountType.set('household');

    await fixture.componentInstance.createAccount();

    expect(tenantContext.createTenant).toHaveBeenCalledWith({
      name: 'Household',
      type: 'household',
    });
    expect(financeService.bootstrapWorkspaces).not.toHaveBeenCalled();
    expect(fixture.componentInstance.currentStep()).toBe('workspace');
  });

  it('bootstraps workspaces only after the workspace step is submitted', async () => {
    financeService.bootstrapWorkspaces.mockResolvedValue({
      requiresOnboarding: false,
      availableWorkspaces: ['business'],
      checklist: [],
    });

    const fixture = TestBed.createComponent(OnboardingComponent);
    fixture.componentInstance.workspaces.set(['business']);
    fixture.componentInstance['createdTenantId'].set('tenant-1');

    await fixture.componentInstance.enableWorkspaces();

    expect(financeService.bootstrapWorkspaces).toHaveBeenCalledWith([
      'business',
    ]);
    expect(tenantContext.selectTenant).toHaveBeenCalledWith('tenant-1');
    expect(fixture.componentInstance.currentStep()).toBe('finance-account');
  });

  it('opens the finance accounts surface from the account setup handoff', async () => {
    const fixture = TestBed.createComponent(OnboardingComponent);

    await fixture.componentInstance.finishFinanceAccountSetup();

    expect(router.navigate).toHaveBeenCalledWith([
      '/finance',
      'personal',
      'accounts',
    ]);
  });

  it('does not skip the account step when an existing tenant is missing a type', async () => {
    tenantContext.activeTenant.mockReturnValue({
      id: 'tenant-legacy',
      name: 'Primary Finance Workspace',
      profileId: 'profile-1',
      appScope: 'finance',
    });

    const fixture = TestBed.createComponent(OnboardingComponent);

    await fixture.componentInstance.ngOnInit();

    expect(financeService.getOnboardingState).not.toHaveBeenCalled();
    expect(fixture.componentInstance.currentStep()).toBe('account');
  });
});
