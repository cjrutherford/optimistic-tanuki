import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProfileContext } from '../../profile.context';
import { TenantContextService } from '../../tenant-context.service';
import { IconComponent, IconName } from '@optimistic-tanuki/common-ui';
import {
  FinanceService,
  FinanceWorkspace,
} from '@optimistic-tanuki/finance-ui';
import { FinCommanderPlanStore } from '@optimistic-tanuki/fin-commander-data-access';
import {
  tenantAccountsRoute,
  tenantPlanRoute,
  tenantPlansRoute,
} from '../../tenant-routes';

type LandingAction = {
  label: string;
  route: string[];
};

function hasBlockingChecklistItems(
  checklist: Array<{ id: string; complete: boolean }>
): boolean {
  const blockingChecklist = checklist.filter(
    (item) => !item.id.startsWith('setup-')
  );
  return (
    blockingChecklist.length === 0 ||
    blockingChecklist.some((item) => !item.complete)
  );
}

@Component({
  selector: 'fc-landing',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  readonly profileContext = inject(ProfileContext);
  private readonly tenantContext = inject(TenantContextService);
  private readonly financeService = inject(FinanceService);
  private readonly planStore = inject(FinCommanderPlanStore);
  readonly onboardingState = signal<{
    requiresOnboarding: boolean;
    availableWorkspaces: FinanceWorkspace[];
    checklist: Array<{ id: string; label: string; complete: boolean }>;
  } | null>(null);

  readonly commandModes: Array<{
    name: string;
    icon: IconName;
    tagline: string;
  }> = [
    {
      name: 'Cash Flow',
      icon: 'wallet',
      tagline:
        'Stay on top of spending, balances, and incoming cash across each workspace.',
    },
    {
      name: 'Goals',
      icon: 'target',
      tagline:
        'Track the reserves, milestones, and funding targets that matter next.',
    },
    {
      name: 'Scenarios',
      icon: 'trending-up',
      tagline:
        'Test what changes before a new expense or income shift hits your plan.',
    },
    {
      name: 'Imports',
      icon: 'download',
      tagline: 'Bring transactions in quickly so your ledgers stay current.',
    },
  ];

  readonly primaryAction = computed<LandingAction>(() => {
    if (!this.profileContext.isAuthenticated()) {
      return { label: 'Get Started', route: ['/register'] };
    }

    if (!this.profileContext.currentProfile()) {
      return { label: 'Finish your profile', route: ['/settings'] };
    }

    if (!this.tenantContext.activeTenant()) {
      return { label: 'Create your account', route: ['/onboarding'] };
    }

    const onboardingState = this.onboardingState();
    if (
      onboardingState &&
      (onboardingState.requiresOnboarding ||
        onboardingState.availableWorkspaces.length === 0)
    ) {
      return { label: 'Choose your workspaces', route: ['/onboarding'] };
    }

    if (
      onboardingState &&
      hasBlockingChecklistItems(onboardingState.checklist)
    ) {
      return {
        label: 'Finish setup',
        route: tenantAccountsRoute(
          this.currentTenantRouteId(),
          this.primaryWorkspace(),
          'setup'
        ),
      };
    }

    const firstPlan = this.planStore.listPlans()[0];
    if (firstPlan) {
      return {
        label: 'Open your plan',
        route: tenantPlanRoute(this.currentTenantRouteId(), firstPlan.id),
      };
    }

    return {
      label: 'Open tenant plans',
      route: tenantPlansRoute(this.currentTenantRouteId()),
    };
  });

  readonly secondaryAction = computed<LandingAction>(() => {
    if (!this.profileContext.isAuthenticated()) {
      return { label: 'Sign In', route: ['/login'] };
    }

    return {
      label: 'Review accounts',
      route: tenantAccountsRoute(
        this.currentTenantRouteId(),
        this.primaryWorkspace()
      ),
    };
  });

  constructor() {
    effect(() => {
      if (!this.profileContext.isAuthenticated()) {
        this.onboardingState.set(null);
        return;
      }

      void this.loadOnboardingState();
    });
  }

  private async loadOnboardingState(): Promise<void> {
    try {
      this.onboardingState.set(await this.financeService.getOnboardingState());
    } catch {
      this.onboardingState.set(null);
    }
  }

  private primaryWorkspace(): FinanceWorkspace {
    return (
      this.onboardingState()?.availableWorkspaces.find(
        (workspace) => workspace !== 'net-worth'
      ) ?? 'personal'
    );
  }

  private currentTenantRouteId(): string {
    if (typeof this.tenantContext.activeTenantId === 'function') {
      return this.tenantContext.activeTenantId() ?? 'active';
    }

    return this.tenantContext.activeTenant()?.id ?? 'active';
  }
}
