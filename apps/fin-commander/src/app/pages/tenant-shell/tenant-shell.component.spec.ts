import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TenantShellComponent } from './tenant-shell.component';
import { TenantContextService } from '../../tenant-context.service';
import { FinCommanderPlanStore } from '@optimistic-tanuki/fin-commander-data-access';
import { FinanceService } from '@optimistic-tanuki/finance-ui';
import { AuthStateService } from '../../state/auth-state.service';

@Component({
  selector: 'fc-router-stub',
  standalone: true,
  template: '',
})
class RouterStubComponent {}

describe('TenantShellComponent', () => {
  const logout = jest.fn();

  beforeEach(async () => {
    logout.mockReset();

    await TestBed.configureTestingModule({
      imports: [TenantShellComponent],
      providers: [
        provideRouter([
          {
            path: 'tenants/:tenantId/overview',
            component: RouterStubComponent,
          },
          {
            path: 'login',
            component: RouterStubComponent,
          },
        ]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({
              get: (key: string) => (key === 'tenantId' ? 'tenant-1' : null),
            }),
            snapshot: { paramMap: { get: (key: string) => key } },
          },
        },
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
          provide: FinCommanderPlanStore,
          useValue: {
            getScope: () => ({ tenantId: 'tenant-1', profileId: 'profile-1' }),
            listPlans: () => [
              {
                id: 'plan-1',
                name: 'Operating Plan',
                description: 'Primary household plan',
                defaultWorkspace: 'personal',
                updatedAt: '2026-06-02',
              },
            ],
          },
        },
        {
          provide: FinanceService,
          useValue: {
            getOnboardingState: jest.fn().mockResolvedValue({
              requiresOnboarding: false,
              availableWorkspaces: ['personal'],
              checklist: [],
            }),
          },
        },
        {
          provide: AuthStateService,
          useValue: {
            logout,
          },
        },
      ],
    }).compileComponents();
  });

  it('renders the active tenant with plans and accounts as sibling tree branches', () => {
    const fixture = TestBed.createComponent(TenantShellComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('North Household');
    expect(text).toContain('Plans');
    expect(text).toContain('Accounts');
    expect(text).toContain('Operating Plan');
  });

  it('exposes a logout action in the navigation tree', () => {
    const fixture = TestBed.createComponent(TenantShellComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const items = component.treeItems();
    const tenantNode = items[0];
    const logoutItem = tenantNode.children?.find(
      (child) => child.label === 'Logout'
    );

    expect(logoutItem).toBeDefined();
    expect(logoutItem?.variant).toBe('danger');
  });

  it('logs out when the logout navigation item is invoked', async () => {
    const fixture = TestBed.createComponent(TenantShellComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const items = component.treeItems();
    const tenantNode = items[0];
    const logoutItem = tenantNode.children?.find(
      (child) => child.label === 'Logout'
    );

    await logoutItem?.action?.();

    expect(logout).toHaveBeenCalled();
  });
});
