import { CommonModule } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import {
  AppBarComponent,
  NavItem,
  NavSidebarComponent,
} from '@optimistic-tanuki/navigation-ui';
import {
  FinanceService,
  FinanceWorkspace,
} from '@optimistic-tanuki/finance-ui';
import { ProfileSelectorComponent } from '../profile-selector.component';
import { TenantSwitcherComponent } from '../tenant-switcher.component';
import { TenantContextService } from '../../tenant-context.service';
import { FinCommanderPlanStore } from '@optimistic-tanuki/fin-commander-data-access';
import { ProfileContext } from '../../profile.context';
import { filter, Subscription } from 'rxjs';

type GuidanceAction = {
  label: string;
  route: string;
  description: string;
};

@Component({
  selector: 'fc-title-bar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    AppBarComponent,
    NavSidebarComponent,
    ProfileSelectorComponent,
    TenantSwitcherComponent,
  ],
  templateUrl: './title-bar.component.html',
  styleUrl: './title-bar.component.scss',
})
export class TitleBarComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly tenantContext = inject(TenantContextService);
  private readonly planStore = inject(FinCommanderPlanStore);
  private readonly financeService = inject(FinanceService);
  private readonly subscriptions = new Subscription();
  readonly profileContext = inject(ProfileContext);

  readonly menuOpen = signal(false);
  readonly helpOpen = signal(false);
  readonly availableWorkspaces = signal<FinanceWorkspace[]>(['personal']);
  readonly onboardingState = signal<{
    requiresOnboarding: boolean;
    availableWorkspaces: FinanceWorkspace[];
    checklist: Array<{ id: string; label: string; complete: boolean }>;
  } | null>(null);
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ),
    { initialValue: null }
  );
  readonly activePlan = computed(() => {
    void this.currentUrl();
    const match = this.router.url.match(/^\/commander\/([^/]+)/);
    const routePlanId = match?.[1] ?? null;

    if (routePlanId) {
      return this.planStore.getPlan(routePlanId) ?? null;
    }

    return this.planStore.listPlans()[0] ?? null;
  });
  readonly activeTenantName = computed(
    () => this.tenantContext.activeTenant()?.name ?? 'Loading account'
  );

  toggleHelp() {
    this.helpOpen.update((v) => !v);
  }

  constructor() {
    effect(() => {
      const isAuthenticated = this.profileContext.isAuthenticated();
      const activeProfileId = this.profileContext.currentProfile()?.id ?? null;
      const activeTenantId = this.tenantContext.activeTenantId();

      if (!isAuthenticated) {
        this.availableWorkspaces.set(['personal']);
        return;
      }

      void activeProfileId;
      void activeTenantId;
      void this.loadAvailableWorkspaces();
    });
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.router.events
        .pipe(filter((event) => event instanceof NavigationEnd))
        .subscribe(() => {
          if (this.profileContext.isAuthenticated()) {
            void this.loadAvailableWorkspaces();
          }
        })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  readonly navItems = computed<NavItem[]>(() => {
    if (!this.profileContext.isAuthenticated()) {
      return [
        {
          label: 'Home',
          action: () => this.go('/'),
        },
        {
          label: 'Register',
          action: () => this.go('/register'),
        },
        {
          label: 'Login',
          action: () => this.go('/login'),
        },
      ];
    }

    return [
      {
        label: 'Ledger',
        action: () => this.go(this.ledgerRoute()),
      },
      {
        label: 'Commander',
        action: () => this.go(this.commanderRoute()),
      },
      {
        label: 'Settings',
        action: () => this.go('/settings'),
      },
    ];
  });

  readonly nextAction = computed<GuidanceAction>(() => {
    if (!this.profileContext.isAuthenticated()) {
      return {
        label: 'Create your login',
        route: '/register',
        description: 'Start with a profile so you can save plans and ledgers.',
      };
    }

    if (!this.profileContext.currentProfile()) {
      return {
        label: 'Finish your profile',
        route: '/settings',
        description: 'Add the profile details you want tied to this account.',
      };
    }

    if (!this.tenantContext.activeTenant()) {
      return {
        label: 'Create your account',
        route: '/onboarding',
        description: 'Set up the account you want to manage in Fin Commander.',
      };
    }

    const onboardingState = this.onboardingState();
    if (
      onboardingState &&
      (onboardingState.requiresOnboarding ||
        onboardingState.availableWorkspaces.length === 0)
    ) {
      return {
        label: 'Choose your workspaces',
        route: '/onboarding',
        description:
          'Pick the ledgers you want ready before you start planning.',
      };
    }

    if (
      onboardingState &&
      (onboardingState.checklist.length === 0 ||
        onboardingState.checklist.some((item) => !item.complete))
    ) {
      return {
        label: 'Finish setup checklist',
        route: `/finance/${this.setupWorkspace()}/setup`,
        description:
          'Add your first financial account and finish the ledger basics.',
      };
    }

    if (!this.activePlan()) {
      return {
        label: 'Create your first plan',
        route: '/commander/new/overview',
        description: 'Start a plan once your account and ledgers are ready.',
      };
    }

    return {
      label: 'Open your plan',
      route: this.commanderRoute(),
      description:
        'Review your active plan, goals, and scenario work in one place.',
    };
  });

  readonly supportingActions = computed<GuidanceAction[]>(() => {
    const actions: GuidanceAction[] = [];

    if (this.profileContext.isAuthenticated()) {
      actions.push({
        label: 'Review your ledger',
        route: this.ledgerRoute(),
        description: 'Open the current ledger workspace.',
      });
    }

    actions.push({
      label: 'Update settings',
      route: '/settings',
      description: 'Manage your profile and account details.',
    });

    return actions.filter((action) => action.route !== this.nextAction().route);
  });

  toggleMenu() {
    this.menuOpen.update((value) => !value);
  }

  go(path: string) {
    void this.router.navigateByUrl(path);
    this.menuOpen.set(false);
  }

  private async loadAvailableWorkspaces(): Promise<void> {
    try {
      const state = await this.financeService.getOnboardingState();
      this.onboardingState.set(state);
      this.availableWorkspaces.set(
        state.availableWorkspaces.length
          ? state.availableWorkspaces
          : ['personal']
      );
    } catch {
      this.onboardingState.set(null);
      this.availableWorkspaces.set(['personal']);
    }
  }

  private ledgerRoute(): string {
    const match = this.router.url.match(/^\/finance\/([^/]+)/);
    const routeWorkspace = match?.[1] as FinanceWorkspace | undefined;
    const workspace =
      routeWorkspace && this.isWorkspace(routeWorkspace)
        ? routeWorkspace
        : this.setupWorkspace();
    return `/finance/${workspace}`;
  }

  private commanderRoute(): string {
    const planId = this.activePlan()?.id;
    return planId ? `/commander/${planId}/overview` : '/commander/new/overview';
  }

  private setupWorkspace(): FinanceWorkspace {
    const onboardingState = this.onboardingState();
    return (
      onboardingState?.availableWorkspaces.find(
        (workspace) => workspace !== 'net-worth'
      ) ??
      this.availableWorkspaces().find(
        (workspace) => workspace !== 'net-worth'
      ) ??
      'personal'
    );
  }

  private isWorkspace(value: string): value is FinanceWorkspace {
    return (
      value === 'personal' || value === 'business' || value === 'net-worth'
    );
  }

  private workspaceLabel(workspace: FinanceWorkspace): string {
    switch (workspace) {
      case 'business':
        return 'Business Ledger';
      case 'net-worth':
        return 'Net Worth';
      default:
        return 'Personal Ledger';
    }
  }
}
