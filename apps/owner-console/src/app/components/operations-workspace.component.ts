import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import {
  OWNER_CONSOLE_MUTATION_MATRIX,
  OwnerConsoleMutationMatrixEntry,
} from '../owner-console-mutation-matrix';
import { AppConfigService } from '../services/app-config.service';
import { AppScopesService } from '../services/app-scopes.service';
import { CommunityService } from '../services/community.service';
import { StoreService } from '../services/store.service';
import { UsersService } from '../services/users.service';

interface DomainStatusCard {
  title: string;
  status: 'Healthy' | 'Attention';
  detail: string;
  route: string;
}

interface ControlPlaneAction {
  title: string;
  description: string;
  route: string;
}

interface MatrixStatusCard {
  label: string;
  count: number;
  tone: 'complete' | 'partial' | 'missing';
}

@Component({
  selector: 'app-operations-workspace',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <section class="operations-page">
      <header class="hero">
        <p class="hero-kicker">Operations Workspace</p>
        <h1>Operational visibility and intervention</h1>
        <p>
          Use this workspace to monitor platform domains, identify attention areas,
          and jump directly into the tools that support operator intervention.
        </p>
      </header>

      <section class="panel">
        <div class="panel-heading">
          <h2>Domain status</h2>
          <p>Current status is derived from the operator data sources available today.</p>
        </div>
        <div class="status-grid">
          @for (card of statusCards; track card.title) {
          <a class="status-card" [routerLink]="card.route">
            <span class="status-badge" [class.attention]="card.status === 'Attention'">
              {{ card.status }}
            </span>
            <h3>{{ card.title }}</h3>
            <p>{{ card.detail }}</p>
          </a>
          }
        </div>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <h2>Control-plane actions</h2>
          <p>These entry points concentrate the workflows platform owners use to intervene.</p>
        </div>
        <div class="actions-grid">
          @for (action of controlPlaneActions; track action.title) {
          <a class="action-card" [routerLink]="action.route">
            <h3>{{ action.title }}</h3>
            <p>{{ action.description }}</p>
          </a>
          }
        </div>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <h2>Mutation coverage matrix</h2>
          <p>
            This matrix tracks every owner-console write flow by workspace, route,
            backend endpoint, and expected permission boundary.
          </p>
        </div>
        <div class="coverage-grid">
          @for (card of matrixStatusCards; track card.label) {
          <article class="coverage-card" [class.partial]="card.tone === 'partial'" [class.missing]="card.tone === 'missing'">
            <span class="coverage-count">{{ card.count }}</span>
            <h3>{{ card.label }}</h3>
          </article>
          }
        </div>
        <div class="gap-list">
          @for (entry of incompleteMatrixEntries; track entry.feature) {
          <article class="gap-card">
            <div class="gap-header">
              <span class="gap-status" [class.missing]="entry.status === 'missing'">
                {{ entry.status }}
              </span>
              <h3>{{ entry.feature }}</h3>
            </div>
            <p><strong>Workspace:</strong> {{ entry.workspace }}</p>
            <p><strong>Route:</strong> {{ entry.uiRoute }}</p>
            <p><strong>Endpoint:</strong> {{ entry.apiEndpoint }}</p>
            <p><strong>Permission:</strong> {{ entry.requiredPermission }}</p>
            <p>{{ entry.notes }}</p>
          </article>
          }
        </div>
      </section>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 24px;
      }

      .operations-page {
        display: grid;
        gap: 24px;
      }

      .hero,
      .panel {
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 24px;
        background:
          radial-gradient(circle at top left, rgba(196, 112, 0, 0.08), transparent 30%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(246, 248, 248, 0.92));
        padding: 24px;
      }

      .hero-kicker {
        margin: 0 0 8px;
        color: #8d4b00;
        font-size: 0.82rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .hero h1,
      .panel-heading h2,
      .status-card h3,
      .action-card h3 {
        margin: 0;
      }

      .hero p,
      .panel-heading p,
      .status-card p,
      .action-card p {
        margin: 12px 0 0;
        line-height: 1.6;
      }

      .panel-heading {
        margin-bottom: 16px;
      }

      .status-grid,
      .actions-grid,
      .coverage-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 16px;
      }

      .status-card,
      .action-card,
      .coverage-card,
      .gap-card {
        display: grid;
        gap: 10px;
        padding: 20px;
        border-radius: 18px;
        border: 1px solid var(--border-color, #d6d6d6);
        background: rgba(255, 255, 255, 0.92);
        color: inherit;
      }

      .status-card,
      .action-card {
        text-decoration: none;
      }

      .status-badge {
        width: fit-content;
        border-radius: 999px;
        padding: 4px 10px;
        background: rgba(19, 125, 54, 0.14);
        color: #0d6b2b;
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      .status-badge.attention {
        background: rgba(196, 112, 0, 0.16);
        color: #8d4b00;
      }

      .coverage-card {
        align-content: start;
      }

      .coverage-card.partial {
        background: rgba(196, 112, 0, 0.08);
      }

      .coverage-card.missing {
        background: rgba(155, 33, 33, 0.08);
      }

      .coverage-count {
        font-size: 2rem;
        font-weight: 700;
        color: #8d4b00;
      }

      .gap-list {
        display: grid;
        gap: 16px;
        margin-top: 16px;
      }

      .gap-header {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .gap-status {
        width: fit-content;
        border-radius: 999px;
        padding: 4px 10px;
        background: rgba(196, 112, 0, 0.16);
        color: #8d4b00;
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      .gap-status.missing {
        background: rgba(155, 33, 33, 0.16);
        color: #8b0000;
      }
    `,
  ],
})
export class OperationsWorkspaceComponent implements OnInit {
  private readonly usersService = inject(UsersService);
  private readonly appScopesService = inject(AppScopesService);
  private readonly appConfigService = inject(AppConfigService);
  private readonly communityService = inject(CommunityService);
  private readonly storeService = inject(StoreService);

  statusCards: DomainStatusCard[] = [];
  matrixStatusCards: MatrixStatusCard[] = [];
  incompleteMatrixEntries: OwnerConsoleMutationMatrixEntry[] = [];
  controlPlaneActions: ControlPlaneAction[] = [
    {
      title: 'Review role assignments',
      description:
        'Jump into governance workflows when platform-wide access or operator authority must change.',
      route: '/dashboard/roles',
    },
    {
      title: 'Publish or revise app configuration',
      description:
        'Move from monitoring into experience intervention when a user-facing surface needs correction.',
      route: '/dashboard/app-config',
    },
    {
      title: 'Resolve order or booking exceptions',
      description:
        'Handle outstanding commerce issues from one entry point into orders, appointments, and availability.',
      route: '/dashboard/store/orders',
    },
    {
      title: 'Stabilize community rollout',
      description:
        'Inspect city and community records whenever localized network coverage needs operator action.',
      route: '/dashboard/communities',
    },
  ];

  ngOnInit(): void {
    this.matrixStatusCards = [
      {
        label: 'Complete flows',
        count: OWNER_CONSOLE_MUTATION_MATRIX.filter(
          (entry) => entry.status === 'complete'
        ).length,
        tone: 'complete',
      },
      {
        label: 'Partial flows',
        count: OWNER_CONSOLE_MUTATION_MATRIX.filter(
          (entry) => entry.status === 'partial'
        ).length,
        tone: 'partial',
      },
      {
        label: 'Missing flows',
        count: OWNER_CONSOLE_MUTATION_MATRIX.filter(
          (entry) => entry.status === 'missing'
        ).length,
        tone: 'missing',
      },
    ];
    this.incompleteMatrixEntries = OWNER_CONSOLE_MUTATION_MATRIX.filter(
      (entry) => entry.status !== 'complete'
    );

    forkJoin({
      governance: forkJoin({
        users: this.usersService.getProfiles().pipe(catchError(() => of(null))),
        appScopes: this.appScopesService
          .getAppScopes()
          .pipe(catchError(() => of(null))),
      }),
      experience: this.appConfigService
        .getConfigurations()
        .pipe(catchError(() => of(null))),
      commerce: forkJoin({
        products: this.storeService.getProducts().pipe(catchError(() => of(null))),
        orders: this.storeService.getOrders().pipe(catchError(() => of(null))),
        appointments: this.storeService
          .getAppointments()
          .pipe(catchError(() => of(null))),
      }),
      communities: forkJoin({
        communities: this.communityService
          .getCommunities()
          .pipe(catchError(() => of(null))),
        cities: this.communityService.getCities().pipe(catchError(() => of(null))),
      }),
    }).subscribe((result) => {
      this.statusCards = [
        {
          title: 'Identity and governance',
          status:
            result.governance.users && result.governance.appScopes
              ? 'Healthy'
              : 'Attention',
          detail:
            result.governance.users && result.governance.appScopes
              ? 'Profiles and app-scope metadata are currently reachable.'
              : 'One or more governance sources did not respond cleanly.',
          route: '/dashboard/governance',
        },
        {
          title: 'Experience delivery',
          status: result.experience ? 'Healthy' : 'Attention',
          detail: result.experience
            ? 'App configuration data is available for publish review.'
            : 'Experience configuration data needs operator investigation.',
          route: '/dashboard/experience',
        },
        {
          title: 'Commerce operations',
          status:
            result.commerce.products &&
            result.commerce.orders &&
            result.commerce.appointments
              ? 'Healthy'
              : 'Attention',
          detail:
            result.commerce.products &&
            result.commerce.orders &&
            result.commerce.appointments
              ? 'Catalog, orders, and booking data are available for intervention.'
              : 'Commerce data is partially unavailable and should be checked.',
          route: '/dashboard/commerce',
        },
        {
          title: 'Community network',
          status:
            result.communities.communities && result.communities.cities
              ? 'Healthy'
              : 'Attention',
          detail:
            result.communities.communities && result.communities.cities
              ? 'Community and city records are reachable for operator workflows.'
              : 'Community topology data needs follow-up from operators.',
          route: '/dashboard/community-ops',
        },
      ];
    });
  }
}
