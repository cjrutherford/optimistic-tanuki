import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { FinanceService } from '@optimistic-tanuki/finance-ui';
import { FinCommanderPlanStore } from '@optimistic-tanuki/fin-commander-data-access';
import { OnboardingComponent } from './onboarding.component';
import { TenantContextService } from '../../tenant-context.service';

describe('OnboardingComponent', () => {
  const financeService = {
    createTenant: jest.fn(),
    bootstrapWorkspaces: jest.fn(),
  };
  const tenantContext = {
    loadTenantContext: jest.fn().mockResolvedValue(undefined),
    activeTenant: jest.fn(),
    selectTenant: jest.fn(),
  };
  const router = {
    navigate: jest.fn().mockResolvedValue(true),
  };
  const planStore = {
    savePlan: jest.fn(),
    listPlans: jest.fn().mockReturnValue([]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [OnboardingComponent],
      providers: [
        { provide: FinanceService, useValue: financeService },
        { provide: TenantContextService, useValue: tenantContext },
        { provide: Router, useValue: router },
        { provide: FinCommanderPlanStore, useValue: planStore },
      ],
    }).compileComponents();
  });

  it('creates the account first and only advances to workspace selection', async () => {
    financeService.createTenant.mockResolvedValue({
      id: 'tenant-1',
      name: 'Household',
      profileId: 'profile-1',
      appScope: 'finance',
      type: 'household',
    });

    const fixture = TestBed.createComponent(OnboardingComponent);
    fixture.componentInstance.accountName.set('Household');
    fixture.componentInstance.accountType.set('household');

    await fixture.componentInstance.createAccount();

    expect(financeService.createTenant).toHaveBeenCalledWith({
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

    await fixture.componentInstance.enableWorkspaces();

    expect(financeService.bootstrapWorkspaces).toHaveBeenCalledWith([
      'business',
    ]);
    expect(fixture.componentInstance.currentStep()).toBe('finance-account');
  });

  it('hands off to the finance setup checklist instead of pretending onboarding is complete', async () => {
    const fixture = TestBed.createComponent(OnboardingComponent);

    await fixture.componentInstance.finishFinanceAccountSetup();

    expect(router.navigate).toHaveBeenCalledWith([
      '/finance',
      'personal',
      'setup',
    ]);
  });
});
