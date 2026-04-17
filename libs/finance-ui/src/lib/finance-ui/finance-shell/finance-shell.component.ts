import { CommonModule } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { FinanceService } from '../services/finance.service';
import { FinanceOnboardingState, FinanceWorkspace } from '../models';
import { Subscription, filter } from 'rxjs';
import { FINANCE_HOST_CONFIG } from '../finance.routes';

@Component({
  selector: 'ot-finance-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <section class="finance-shell">
      <header class="hero">
        <div>
          <p class="eyebrow">{{ shellTitle() }}</p>
          <h1>{{ heroHeading() }}</h1>
          <p class="lede">Track and manage your finances.</p>
        </div>

        @if (onboardingState(); as state) {
        <div class="status-card">
          <h2>Setup Progress</h2>
          <p>
            {{ completedChecklistCount() }}/{{ state.checklist.length }} steps
            complete
          </p>
          <a [routerLink]="setupProgressRoute()">Review setup</a>
        </div>
        }
      </header>

      @if (router.url !== onboardingPath()) {
      <nav class="subnav" aria-label="Workspace sections">
        <a
          [routerLink]="workspaceLink(currentWorkspace())"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
          >Overview</a
        >
        <a
          [routerLink]="workspaceSectionLink(currentWorkspace(), 'setup')"
          routerLinkActive="active"
          >Setup</a
        >
        <a
          [routerLink]="workspaceSectionLink(currentWorkspace(), 'accounts')"
          routerLinkActive="active"
          >Accounts</a
        >
        <a
          [routerLink]="
            workspaceSectionLink(currentWorkspace(), 'transactions')
          "
          routerLinkActive="active"
          >Transactions</a
        >
        @if (currentWorkspace() !== 'net-worth') {
        <a
          [routerLink]="workspaceSectionLink(currentWorkspace(), 'budgets')"
          routerLinkActive="active"
          >Budgets</a
        >
        <a
          [routerLink]="workspaceSectionLink(currentWorkspace(), 'recurring')"
          routerLinkActive="active"
          >Recurring</a
        >
        } @if (currentWorkspace() === 'net-worth') {
        <a
          [routerLink]="workspaceSectionLink('net-worth', 'assets')"
          routerLinkActive="active"
          >Assets</a
        >
        }
      </nav>
      }

      <router-outlet></router-outlet>
    </section>
  `,
  styles: [
    `
      .finance-shell {
        padding: 24px;
        background: var(--background, #f8fafc);
        min-height: 100%;
        color: var(--foreground, #1f2937);
        font-family: var(--font-body, 'Helvetica Neue', Arial, sans-serif);
      }
      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(240px, 320px);
        gap: 20px;
        align-items: start;
        margin-bottom: 24px;
      }
      .eyebrow {
        margin: 0 0 8px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 12px;
        color: var(--muted, #6b7280);
      }
      h1 {
        margin: 0;
        font-size: clamp(32px, 4vw, 52px);
        line-height: 1.02;
        max-width: 10ch;
        font-family: var(--font-heading, 'Helvetica Neue', Arial, sans-serif);
      }
      .lede {
        max-width: 56ch;
        color: var(--muted, #6b7280);
        font-size: 16px;
      }
      .status-card {
        padding: 18px;
        border-radius: var(--border-radius-lg, 18px);
        background: var(--surface, #ffffff);
        border: 1px solid var(--border, rgba(148, 163, 184, 0.2));
        box-shadow: var(--shadow-md, 0 20px 40px rgba(15, 23, 42, 0.08));
      }
      .status-card h2,
      .status-card p {
        margin: 0 0 8px;
      }
      .status-card a {
        color: var(--primary, #2563eb);
        font-weight: 600;
        text-decoration: none;
      }
      .subnav {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 24px;
      }
      .subnav a {
        padding: 9px 14px;
        border-radius: var(--border-radius-full, 999px);
        background: var(--surface, #ffffff);
        color: var(--primary, #2563eb);
        text-decoration: none;
        font-weight: 600;
        border: 1px solid var(--border, rgba(148, 163, 184, 0.2));
      }
      .subnav a.active {
        background: var(--accent, #d97706);
        color: var(--background, #ffffff);
      }
      @media (max-width: 800px) {
        .hero {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class FinanceShellComponent implements OnInit, OnDestroy {
  private readonly financeService = inject(FinanceService);
  private readonly hostConfig = inject(FINANCE_HOST_CONFIG);
  readonly router = inject(Router);
  private readonly subscriptions = new Subscription();

  readonly onboardingState = signal<FinanceOnboardingState | null>(null);
  readonly currentWorkspace = signal<FinanceWorkspace>('personal');
  readonly shellTitle = computed(() => this.hostConfig.shellTitle);
  readonly heroHeading = computed(() => `${this.hostConfig.shellTitle}`);
  readonly workspaces = computed(() => {
    const workspaceLabels = this.hostConfig.workspaceLabels ?? {};

    return [
      {
        id: 'personal' as const,
        label: workspaceLabels.personal?.label ?? 'Personal',
        description:
          workspaceLabels.personal?.description ??
          'Cash flow, bills, and everyday spending',
        navLabel: workspaceLabels.personal?.navLabel ?? 'Everyday money',
      },
      {
        id: 'business' as const,
        label: workspaceLabels.business?.label ?? 'Business',
        description:
          workspaceLabels.business?.description ??
          'Operating cash, expenses, and income',
        navLabel: workspaceLabels.business?.navLabel ?? 'Operating cash',
      },
      {
        id: 'net-worth' as const,
        label: workspaceLabels['net-worth']?.label ?? 'Net Worth',
        description:
          workspaceLabels['net-worth']?.description ??
          'Aggregate balances and tracked assets',
        navLabel: workspaceLabels['net-worth']?.navLabel ?? 'Full picture',
      },
    ];
  });

  async ngOnInit() {
    const state = await this.financeService.getOnboardingState();
    this.onboardingState.set(state);
    this.syncWorkspace();
    this.subscriptions.add(
      this.router.events
        .pipe(filter((event) => event instanceof NavigationEnd))
        .subscribe(() => this.syncWorkspace())
    );

    if (
      state.requiresOnboarding &&
      this.router.url === this.hostConfig.routeBase
    ) {
      await this.router.navigateByUrl('/onboarding');
    }
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  syncWorkspace() {
    const segment = this.router.url.split('/')[2] as
      | FinanceWorkspace
      | undefined;
    if (
      segment === 'personal' ||
      segment === 'business' ||
      segment === 'net-worth'
    ) {
      this.currentWorkspace.set(segment);
    }
  }

  completedChecklistCount(): number {
    return (
      this.onboardingState()?.checklist.filter((item) => item.complete)
        .length ?? 0
    );
  }

  onboardingLink(): string[] {
    return ['/', ...this.routeBaseSegments(), 'onboarding'];
  }

  setupProgressRoute(): string[] {
    const state = this.onboardingState();
    if (
      state &&
      (state.requiresOnboarding || state.availableWorkspaces.length === 0)
    ) {
      return ['/onboarding'];
    }

    return ['/', ...this.routeBaseSegments(), this.currentWorkspace(), 'setup'];
  }

  onboardingPath(): string {
    return [...this.routeBaseSegments(), 'onboarding']
      .join('/')
      .replace(/^/, '/');
  }

  workspaceLink(workspace: FinanceWorkspace): string[] {
    return ['/', ...this.routeBaseSegments(), workspace];
  }

  workspaceSectionLink(workspace: FinanceWorkspace, section: string): string[] {
    return ['/', ...this.routeBaseSegments(), workspace, section];
  }

  private routeBaseSegments(): string[] {
    return this.hostConfig.routeBase.split('/').filter(Boolean);
  }
}
