import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  Router,
  RouterOutlet,
  ActivatedRoute,
} from '@angular/router';
import { filter } from 'rxjs';
import { FinCommanderPlanStore } from '@optimistic-tanuki/fin-commander-data-access';
import {
  FinanceService,
  FinanceWorkspace,
} from '@optimistic-tanuki/finance-ui';
import { NavItem, NavSidebarComponent } from '@optimistic-tanuki/navigation-ui';
import { PermissionsService } from '../../permissions.service';
import { TenantContextService } from '../../tenant-context.service';
import { AuthStateService } from '../../state/auth-state.service';
import { LOGIN_ROUTE_PATH } from '../../app.routes';
import {
  tenantAccountsRoute,
  tenantOverviewRoute,
  tenantPlanRoute,
  tenantPlansRoute,
} from '../../tenant-routes';

type PlanSection = 'overview' | 'cash-flow' | 'goals' | 'scenarios' | 'imports';

@Component({
  selector: 'fc-tenant-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavSidebarComponent],
  template: `
    <section class="tenant-shell">
      <button
        type="button"
        class="mobile-nav-toggle"
        (click)="toggleMobileNav()"
      >
        Browse tenant
      </button>

      <aside class="sidebar-column">
        <otui-nav-sidebar
          [isOpen]="true"
          [heading]="'Tenant structure'"
          [navItems]="treeItems()"
          mode="docked"
        ></otui-nav-sidebar>
      </aside>

      <main class="content-column">
        <router-outlet></router-outlet>
      </main>
    </section>

    <otui-nav-sidebar
      [isOpen]="mobileNavOpen()"
      [heading]="'Tenant structure'"
      [navItems]="treeItems()"
      mode="drawer"
      (close)="mobileNavOpen.set(false)"
    ></otui-nav-sidebar>
  `,
  styles: [
    `
      .tenant-shell {
        width: min(1400px, calc(100% - 1rem));
        margin: 0 auto;
        padding: 1rem 0 2rem;
        display: grid;
        grid-template-columns: minmax(260px, 300px) minmax(0, 1fr);
        gap: 1rem;
      }

      .sidebar-column {
        display: block;
      }

      .content-column {
        min-width: 0;
      }

      .mobile-nav-toggle {
        display: none;
        margin: 0 0 0.75rem;
        background: color-mix(in srgb, var(--surface) 92%, transparent);
        color: var(--foreground);
        border: var(--fc-border-width, 2px) solid
          color-mix(in srgb, var(--border) 45%, transparent);
      }

      @media (max-width: 960px) {
        .tenant-shell {
          width: min(100%, calc(100% - 1rem));
          grid-template-columns: 1fr;
        }

        .sidebar-column {
          display: none;
        }

        .mobile-nav-toggle {
          display: inline-flex;
        }
      }
    `,
  ],
})
export class TenantShellComponent implements OnInit {
  private readonly tenantContext = inject(TenantContextService);
  private readonly store = inject(FinCommanderPlanStore);
  private readonly permissions = inject(PermissionsService);
  private readonly financeService = inject(FinanceService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authState = inject(AuthStateService);

  readonly mobileNavOpen = signal(false);
  readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ),
    { initialValue: null }
  );
  readonly onboardingState = signal<{
    requiresOnboarding: boolean;
    availableWorkspaces: FinanceWorkspace[];
    checklist: Array<{ id: string; label: string; complete: boolean }>;
  } | null>(null);
  readonly tenant = computed(
    () =>
      this.tenantContext.activeTenant() ?? {
        id: this.route.snapshot.paramMap.get('tenantId') ?? 'active',
        name: 'Active Tenant',
        type: null,
      }
  );
  readonly plans = computed(() => {
    this.store.getScope();
    return this.store.listPlans();
  });

  async ngOnInit(): Promise<void> {
    try {
      this.onboardingState.set(await this.financeService.getOnboardingState());
    } catch {
      this.onboardingState.set(null);
    }
  }

  readonly treeItems = computed<NavItem[]>(() => {
    void this.currentUrl();
    const tenantId = this.tenant().id;
    const activePlanId = this.activePlanId();
    const state = this.onboardingState();
    const availableWorkspaces = state?.availableWorkspaces ?? ['personal'];
    const primaryWorkspace =
      availableWorkspaces.find((workspace) => workspace !== 'net-worth') ??
      'personal';
    const showSetup =
      !state ||
      state.requiresOnboarding ||
      state.availableWorkspaces.length === 0 ||
      state.checklist.some((item) => !item.complete);

    const plansNode: NavItem = {
      label: 'Plans',
      isActive: this.isActive(`/tenants/${tenantId}/plans`),
      action: () => this.navigate(tenantPlansRoute(tenantId)),
      children: this.plans().map((plan) => ({
        label: plan.name,
        isActive: activePlanId === plan.id,
        action: () => this.navigate(tenantPlanRoute(tenantId, plan.id)),
        children:
          activePlanId === plan.id
            ? this.planSectionItems(tenantId, plan.id)
            : undefined,
      })),
    };

    const accountChildren: NavItem[] = [
      {
        label: 'Accounts',
        isActive: this.isActive(
          `/tenants/${tenantId}/accounts/${primaryWorkspace}/accounts`
        ),
        action: () =>
          this.navigate(
            tenantAccountsRoute(tenantId, primaryWorkspace, 'accounts')
          ),
      },
      {
        label: 'Transactions',
        isActive: this.isActive(
          `/tenants/${tenantId}/accounts/${primaryWorkspace}/transactions`
        ),
        action: () =>
          this.navigate(
            tenantAccountsRoute(tenantId, primaryWorkspace, 'transactions')
          ),
      },
      {
        label: 'Budgets',
        isActive: this.isActive(
          `/tenants/${tenantId}/accounts/${primaryWorkspace}/budgets`
        ),
        action: () =>
          this.navigate(
            tenantAccountsRoute(tenantId, primaryWorkspace, 'budgets')
          ),
      },
      {
        label: 'Recurring',
        isActive: this.isActive(
          `/tenants/${tenantId}/accounts/${primaryWorkspace}/recurring`
        ),
        action: () =>
          this.navigate(
            tenantAccountsRoute(tenantId, primaryWorkspace, 'recurring')
          ),
      },
    ];

    if (availableWorkspaces.includes('business')) {
      accountChildren.push(
        {
          label: 'Invoices',
          isActive: this.isActive(
            `/tenants/${tenantId}/accounts/business/invoices`
          ),
          action: () =>
            this.navigate(
              tenantAccountsRoute(tenantId, 'business', 'invoices')
            ),
        },
        {
          label: 'Checkout',
          isActive: this.isActive(
            `/tenants/${tenantId}/accounts/business/checkout`
          ),
          action: () =>
            this.navigate(
              tenantAccountsRoute(tenantId, 'business', 'checkout')
            ),
        },
        {
          label: 'Payments',
          isActive: this.isActive(
            `/tenants/${tenantId}/accounts/business/payments`
          ),
          action: () =>
            this.navigate(
              tenantAccountsRoute(tenantId, 'business', 'payments')
            ),
        }
      );
    }

    if (availableWorkspaces.includes('net-worth')) {
      accountChildren.push({
        label: 'Assets',
        isActive: this.isActive(
          `/tenants/${tenantId}/accounts/net-worth/assets`
        ),
        action: () =>
          this.navigate(tenantAccountsRoute(tenantId, 'net-worth', 'assets')),
      });
    }

    if (showSetup) {
      accountChildren.push({
        label: 'Setup',
        isActive: this.isActive(
          `/tenants/${tenantId}/accounts/${primaryWorkspace}/setup`
        ),
        action: () =>
          this.navigate(
            tenantAccountsRoute(tenantId, primaryWorkspace, 'setup')
          ),
      });
    }

    return [
      {
        label: this.tenant().name,
        isActive: this.isActive(`/tenants/${tenantId}`),
        action: () => this.navigate(tenantOverviewRoute(tenantId)),
        children: [
          {
            label: 'Overview',
            isActive: this.isActive(`/tenants/${tenantId}/overview`),
            action: () => this.navigate(tenantOverviewRoute(tenantId)),
          },
          plansNode,
          {
            label: 'Accounts',
            isActive: this.isActive(`/tenants/${tenantId}/accounts`),
            action: () =>
              this.navigate(tenantAccountsRoute(tenantId, primaryWorkspace)),
            children: accountChildren,
          },
          {
            label: 'Logout',
            variant: 'danger',
            action: () => this.logout(),
          },
        ],
      },
    ];
  });

  private navigate(commands: string[]): void {
    this.mobileNavOpen.set(false);
    void this.router.navigate(commands);
  }

  toggleMobileNav(): void {
    this.mobileNavOpen.update((value) => !value);
  }

  private async logout(): Promise<void> {
    this.mobileNavOpen.set(false);
    this.authState.logout();
    await this.router.navigate(['/', LOGIN_ROUTE_PATH]);
  }

  private activePlanId(): string | null {
    const match = this.router.url.match(/\/plans\/([^/]+)/);
    return match?.[1] ?? null;
  }

  private isActive(prefix: string): boolean {
    return (
      this.router.url === prefix || this.router.url.startsWith(`${prefix}/`)
    );
  }

  private planSectionItems(tenantId: string, planId: string): NavItem[] {
    const sections: Array<{
      label: string;
      section: PlanSection;
      permission: string;
    }> = [
      {
        label: 'Overview',
        section: 'overview',
        permission: 'finance.summary.read',
      },
      {
        label: 'Cash Flow',
        section: 'cash-flow',
        permission: 'finance.transaction.read',
      },
      {
        label: 'Goals',
        section: 'goals',
        permission: 'finance.budget.read',
      },
      {
        label: 'Scenarios',
        section: 'scenarios',
        permission: 'finance.account.read',
      },
      {
        label: 'Imports',
        section: 'imports',
        permission: 'finance.account.read',
      },
    ];

    return sections
      .filter((item) => this.permissions.can(item.permission))
      .map((item) => ({
        label: item.label,
        isActive: this.isActive(
          tenantPlanRoute(tenantId, planId, item.section).join('/')
        ),
        action: () =>
          this.navigate(tenantPlanRoute(tenantId, planId, item.section)),
      }));
  }
}
