import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProfileContext } from '../../profile.context';
import { TenantContextService } from '../../tenant-context.service';
import {
  FinanceService,
  FinanceWorkspace,
} from '@optimistic-tanuki/finance-ui';
import { FinCommanderPlanStore } from '@optimistic-tanuki/fin-commander-data-access';

type LandingAction = {
  label: string;
  route: string[];
};

@Component({
  selector: 'fc-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
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

  readonly commandModes = [
    {
      name: 'Cash Flow',
      icon: '💸',
      tagline:
        'Stay on top of spending, balances, and incoming cash across each workspace.',
    },
    {
      name: 'Goals',
      icon: '🎯',
      tagline:
        'Track the reserves, milestones, and funding targets that matter next.',
    },
    {
      name: 'Scenarios',
      icon: '🔮',
      tagline:
        'Test what changes before a new expense or income shift hits your plan.',
    },
    {
      name: 'Imports',
      icon: '📥',
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
      (onboardingState.checklist.length === 0 ||
        onboardingState.checklist.some((item) => !item.complete))
    ) {
      return {
        label: 'Finish setup',
        route: ['/finance', this.primaryWorkspace(), 'setup'],
      };
    }

    const firstPlan = this.planStore.listPlans()[0];
    if (firstPlan) {
      return {
        label: 'Open your plan',
        route: ['/commander', firstPlan.id, 'overview'],
      };
    }

    return {
      label: 'Create your first plan',
      route: ['/commander', 'new', 'overview'],
    };
  });

  readonly secondaryAction = computed<LandingAction>(() => {
    if (!this.profileContext.isAuthenticated()) {
      return { label: 'Sign In', route: ['/login'] };
    }

    return {
      label: 'Review your ledger',
      route: ['/finance', this.primaryWorkspace()],
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
}
