import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { AppConfiguration } from '@optimistic-tanuki/app-config-models';
import { CommunityDto } from '@optimistic-tanuki/ui-models';
import { AppConfigService } from '../services/app-config.service';
import { AppScopesService } from '../services/app-scopes.service';
import { CommunityService } from '../services/community.service';
import { Order, StoreService } from '../services/store.service';
import { UsersService } from '../services/users.service';
import {
  OPERATOR_WORKSPACES,
  OperatorWorkspaceConfig,
} from '../operator-workspaces';

interface OverviewMetric {
  label: string;
  value: string;
  detail: string;
}

interface AttentionItem {
  title: string;
  detail: string;
  route: string;
}

@Component({
  selector: 'app-operator-overview',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <section class="overview-page">
      <header class="hero">
        <p class="hero-kicker">Platform Owner Console</p>
        <h1>Unified operator control plane</h1>
        <p>
          Govern access, steer user-facing experiences, manage business operations,
          and intervene across communities from a single workspace-oriented console.
        </p>
      </header>

      <section class="metrics-grid" *ngIf="!loading; else loadingState">
        @for (metric of metrics; track metric.label) {
        <article class="metric-card">
          <span class="metric-value">{{ metric.value }}</span>
          <h2>{{ metric.label }}</h2>
          <p>{{ metric.detail }}</p>
        </article>
        }
      </section>

      <section class="attention-panel" *ngIf="!loading">
        <div class="panel-heading">
          <h2>Needs operator attention</h2>
          <a routerLink="/dashboard/operations">Open Operations</a>
        </div>
        <div class="attention-grid">
          @for (item of attentionItems; track item.title) {
          <a class="attention-card" [routerLink]="item.route">
            <h3>{{ item.title }}</h3>
            <p>{{ item.detail }}</p>
          </a>
          }
        </div>
      </section>

      <section class="workspace-panel">
        <div class="panel-heading">
          <h2>Operator workspaces</h2>
          <p>Each workspace organizes existing tools into one management outcome.</p>
        </div>
        <div class="workspace-grid">
          @for (workspace of workspaces; track workspace.path) {
          <a class="workspace-card" [routerLink]="['/dashboard', workspace.path]">
            <span>{{ workspace.label }}</span>
            <h3>{{ workspace.summary }}</h3>
            <p>{{ workspace.description }}</p>
          </a>
          }
        </div>
      </section>

      <ng-template #loadingState>
        <section class="metrics-grid">
          @for (slot of [1, 2, 3, 4, 5]; track slot) {
          <article class="metric-card skeleton">
            <span class="metric-value">...</span>
            <h2>Loading</h2>
            <p>Collecting operator metrics.</p>
          </article>
          }
        </section>
      </ng-template>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 24px;
      }

      .overview-page {
        display: grid;
        gap: 24px;
      }

      .hero,
      .attention-panel,
      .workspace-panel {
        border-radius: 24px;
        border: 1px solid var(--border-color, #d6d6d6);
        background:
          radial-gradient(circle at top right, rgba(10, 108, 116, 0.08), transparent 34%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(246, 248, 248, 0.92));
        padding: 24px;
      }

      .hero-kicker {
        margin: 0 0 8px;
        color: var(--accent, #0a6c74);
        font-size: 0.82rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .hero h1,
      .panel-heading h2,
      .metric-card h2,
      .attention-card h3,
      .workspace-card h3 {
        margin: 0;
      }

      .hero p {
        margin: 12px 0 0;
        max-width: 70ch;
        line-height: 1.6;
      }

      .metrics-grid,
      .attention-grid,
      .workspace-grid {
        display: grid;
        gap: 16px;
      }

      .metrics-grid {
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }

      .attention-grid,
      .workspace-grid {
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      }

      .metric-card,
      .attention-card,
      .workspace-card {
        display: grid;
        gap: 10px;
        border-radius: 18px;
        border: 1px solid var(--border-color, #d6d6d6);
        background: rgba(255, 255, 255, 0.9);
        padding: 20px;
        text-decoration: none;
        color: inherit;
      }

      .metric-value {
        font-size: 2rem;
        font-weight: 700;
        color: var(--accent, #0a6c74);
      }

      .panel-heading {
        display: flex;
        justify-content: space-between;
        align-items: end;
        gap: 16px;
        margin-bottom: 16px;
      }

      .panel-heading p,
      .panel-heading a,
      .metric-card p,
      .attention-card p,
      .workspace-card p {
        margin: 0;
        line-height: 1.5;
      }

      .workspace-card span {
        font-size: 0.82rem;
        font-weight: 700;
        color: var(--accent, #0a6c74);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .skeleton {
        opacity: 0.7;
      }
    `,
  ],
})
export class OperatorOverviewComponent implements OnInit {
  private readonly usersService = inject(UsersService);
  private readonly appScopesService = inject(AppScopesService);
  private readonly appConfigService = inject(AppConfigService);
  private readonly communityService = inject(CommunityService);
  private readonly storeService = inject(StoreService);

  loading = true;
  metrics: OverviewMetric[] = [];
  attentionItems: AttentionItem[] = [];
  workspaces: OperatorWorkspaceConfig[] = OPERATOR_WORKSPACES;

  ngOnInit(): void {
    forkJoin({
      users: this.usersService.getProfiles().pipe(catchError(() => of([]))),
      appScopes: this.appScopesService
        .getAppScopes()
        .pipe(catchError(() => of([]))),
      configs: this.appConfigService
        .getConfigurations()
        .pipe(catchError(() => of([]))),
      communities: this.communityService
        .getCommunities()
        .pipe(catchError(() => of([]))),
      cities: this.communityService.getCities().pipe(catchError(() => of([]))),
      products: this.storeService.getProducts().pipe(catchError(() => of([]))),
      orders: this.storeService.getOrders().pipe(catchError(() => of([]))),
      appointments: this.storeService
        .getAppointments()
        .pipe(catchError(() => of([]))),
    }).subscribe((data) => {
      this.metrics = this.buildMetrics(data);
      this.attentionItems = this.buildAttentionItems(
        data.configs,
        data.orders,
        data.appointments as { status?: string }[],
        data.communities,
        data.cities
      );
      this.loading = false;
    });
  }

  private buildMetrics(data: {
    users: unknown[];
    appScopes: unknown[];
    configs: AppConfiguration[];
    communities: CommunityDto[];
    cities: CommunityDto[];
    products: unknown[];
    orders: Order[];
    appointments: unknown[];
  }): OverviewMetric[] {
    return [
      {
        label: 'Governed Profiles',
        value: String(data.users.length),
        detail: `${data.appScopes.length} app scopes currently define access boundaries.`,
      },
      {
        label: 'Published Experiences',
        value: String(data.configs.filter((config) => config.active).length),
        detail: `${data.configs.length} total app configurations are available to operators.`,
      },
      {
        label: 'Commerce Surfaces',
        value: String(data.products.length),
        detail: `${data.orders.length} orders are currently visible for operator review.`,
      },
      {
        label: 'Communities',
        value: String(data.communities.length),
        detail: `${data.cities.length} city-locality records are tracked in the network.`,
      },
      {
        label: 'Service Appointments',
        value: String(data.appointments.length),
        detail: 'Bookings and availability controls remain under direct operator review.',
      },
    ];
  }

  private buildAttentionItems(
    configs: AppConfiguration[],
    orders: Order[],
    appointments: { status?: string }[],
    communities: CommunityDto[],
    cities: CommunityDto[]
  ): AttentionItem[] {
    const draftConfigs = configs.filter((config) => !config.active).length;
    const openOrders = orders.filter((order) =>
      !['complete', 'completed', 'fulfilled', 'cancelled'].includes(
        order.status?.toLowerCase?.() ?? ''
      )
    ).length;
    const pendingAppointments = appointments.filter((appointment) =>
      ['pending', 'requested', 'awaiting_approval'].includes(
        appointment.status?.toLowerCase?.() ?? ''
      )
    ).length;

    return [
      {
        title: 'Experience changes waiting on publish review',
        detail:
          draftConfigs > 0
            ? `${draftConfigs} configurations are still inactive or draft.`
            : 'All known application configurations are currently active.',
        route: '/dashboard/experience',
      },
      {
        title: 'Commerce exceptions',
        detail:
          openOrders > 0
            ? `${openOrders} orders still appear actionable from the current dataset.`
            : 'No actionable orders detected from the current order snapshot.',
        route: '/dashboard/commerce',
      },
      {
        title: 'Booking follow-up',
        detail:
          pendingAppointments > 0
            ? `${pendingAppointments} appointments still require approval or scheduling.`
            : 'No pending appointment approvals were detected.',
        route: '/dashboard/operations',
      },
      {
        title: 'Community coverage',
        detail: `${communities.length} communities are spread across ${cities.length} city records.`,
        route: '/dashboard/community-ops',
      },
    ];
  }
}
