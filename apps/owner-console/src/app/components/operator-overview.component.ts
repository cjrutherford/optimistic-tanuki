import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { AppConfiguration } from '@optimistic-tanuki/app-config-models';
import { CommunityDto } from '@optimistic-tanuki/ui-models';
import { OperatorQueuePanelComponent } from './operator-queue-panel.component';
import { AppConfigService } from '../services/app-config.service';
import { AppScopesService } from '../services/app-scopes.service';
import { CommunityService } from '../services/community.service';
import {
  OperatorQueueItem,
  OperatorQueueService,
} from '../services/operator-queue.service';
import { Order, StoreService } from '../services/store.service';
import { UsersService } from '../services/users.service';
import {
  OPERATOR_WORKSPACES,
  OperatorWorkspaceConfig,
} from '../operator-workspaces';

export type OverviewSourceKey =
  | 'users'
  | 'appScopes'
  | 'configs'
  | 'communities'
  | 'cities'
  | 'products'
  | 'orders'
  | 'appointments';

type SourceStatus = 'loading' | 'ready' | 'error';

interface SourceState {
  status: SourceStatus;
  data: unknown[];
}

type SourceStates = Record<OverviewSourceKey, SourceState>;

interface OverviewMetric {
  key: string;
  label: string;
  value: string;
  detail: string;
  status: SourceStatus;
  sources: OverviewSourceKey[];
}

interface AttentionItem {
  key: string;
  title: string;
  detail: string;
  route: string;
  status: SourceStatus;
  sources: OverviewSourceKey[];
}

@Component({
  selector: 'app-operator-overview',
  standalone: true,
  imports: [CommonModule, RouterModule, OperatorQueuePanelComponent],
  template: `
    <section class="overview-page">
      <header class="hero">
        <p class="hero-kicker">Platform Owner Console</p>
        <h1>Unified operator control plane</h1>
        <p>
          Govern access, steer user-facing experiences, manage business
          operations, and intervene across communities from a single
          workspace-oriented console.
        </p>
      </header>

      <section class="metrics-grid">
        @for (metric of metrics; track metric.key) {
        <article
          class="metric-card"
          [class.skeleton]="metric.status === 'loading'"
          [class.metric-card--error]="metric.status === 'error'"
        >
          <span class="metric-value">{{ metricValue(metric) }}</span>
          <h2>{{ metric.label }}</h2>
          <p>{{ metric.detail }}</p>
          @if (metric.status === 'error') {
          <button type="button" class="retry" (click)="retryTile(metric)">
            Retry
          </button>
          }
        </article>
        }
      </section>

      @if (queueStatus === 'error') {
      <section class="attention-panel queue-error">
        <div class="panel-heading">
          <h2>Operator Queue</h2>
        </div>
        <p>Unavailable. The work queue could not be loaded.</p>
        <button type="button" class="retry" (click)="retryQueue()">
          Retry
        </button>
      </section>
      } @else {
      <app-operator-queue-panel
        *ngIf="queueStatus === 'ready'"
        [items]="queueItems"
      ></app-operator-queue-panel>
      }

      <section class="attention-panel">
        <div class="panel-heading">
          <h2>Needs operator attention</h2>
          <a routerLink="/dashboard/operations">Open Operations</a>
        </div>
        <div class="attention-grid">
          @for (item of attentionItems; track item.key) {
          <a
            class="attention-card"
            [class.attention-card--error]="item.status === 'error'"
            [routerLink]="item.route"
          >
            <h3>{{ item.title }}</h3>
            <p>{{ item.detail }}</p>
            @if (item.status === 'error') {
            <button
              type="button"
              class="retry"
              (click)="
                retryTile(item);
                $event.preventDefault();
                $event.stopPropagation()
              "
            >
              Retry
            </button>
            }
          </a>
          }
        </div>
      </section>

      <section class="workspace-panel">
        <div class="panel-heading">
          <h2>Operator workspaces</h2>
          <p>
            Each workspace organizes existing tools into one management outcome.
          </p>
        </div>
        <div class="workspace-grid">
          @for (workspace of workspaces; track workspace.path) {
          <a
            class="workspace-card"
            [routerLink]="['/dashboard', workspace.path]"
          >
            <span>{{ workspace.label }}</span>
            <h3>{{ workspace.summary }}</h3>
            <p>{{ workspace.description }}</p>
          </a>
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

      .overview-page {
        display: grid;
        gap: 24px;
      }

      .hero,
      .attention-panel,
      .workspace-panel {
        border-radius: 24px;
        border: 1px solid var(--border-color, #d6d6d6);
        background: radial-gradient(
            circle at top right,
            color-mix(in srgb, var(--accent, var(--primary)) 10%, transparent),
            transparent 34%
          ),
          linear-gradient(
            180deg,
            color-mix(in srgb, var(--surface, #ffffff) 96%, transparent),
            color-mix(
              in srgb,
              var(--surface, #ffffff) 88%,
              var(--background, #f8fafc)
            )
          );
        padding: 24px;
        color: var(--foreground, #111827);
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
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 92%,
          transparent
        );
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

      .metric-card--error,
      .attention-card--error {
        border-color: var(--danger, #b91c1c);
      }

      .metric-card--error .metric-value {
        color: var(--danger, #b91c1c);
      }

      .retry {
        justify-self: start;
        cursor: pointer;
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: var(--personality-input-radius, 8px);
        background: transparent;
        color: inherit;
        font: inherit;
        padding: 6px 14px;
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
  private readonly operatorQueueService = inject(OperatorQueueService);

  metrics: OverviewMetric[] = [];
  queueItems: OperatorQueueItem[] = [];
  queueStatus: SourceStatus = 'loading';
  attentionItems: AttentionItem[] = [];
  workspaces: OperatorWorkspaceConfig[] = OPERATOR_WORKSPACES;

  private sources: SourceStates = {
    users: { status: 'loading', data: [] },
    appScopes: { status: 'loading', data: [] },
    configs: { status: 'loading', data: [] },
    communities: { status: 'loading', data: [] },
    cities: { status: 'loading', data: [] },
    products: { status: 'loading', data: [] },
    orders: { status: 'loading', data: [] },
    appointments: { status: 'loading', data: [] },
  };

  private readonly fetchers: Record<
    OverviewSourceKey,
    () => Observable<unknown[]>
  > = {
    users: () => this.usersService.getProfiles(),
    appScopes: () => this.appScopesService.getAppScopes(),
    configs: () => this.appConfigService.getConfigurations(),
    communities: () => this.communityService.getCommunities(),
    cities: () => this.communityService.getCities(),
    products: () => this.storeService.getProducts(),
    orders: () => this.storeService.getOrders(),
    appointments: () => this.storeService.getAppointments(),
  };

  ngOnInit(): void {
    this.refreshDerived();
    (Object.keys(this.fetchers) as OverviewSourceKey[]).forEach((key) =>
      this.loadSource(key)
    );
    this.retryQueue();
  }

  metricValue(metric: OverviewMetric): string {
    if (metric.status === 'error') return 'Unavailable';
    if (metric.status === 'loading') return '…';
    return metric.value;
  }

  retryTile(tile: { sources: OverviewSourceKey[] }): void {
    tile.sources
      .filter((key) => this.sources[key].status === 'error')
      .forEach((key) => this.loadSource(key));
  }

  retryQueue(): void {
    this.queueStatus = 'loading';
    this.operatorQueueService.getOverviewQueue().subscribe({
      next: (items) => {
        this.queueItems = items;
        this.queueStatus = 'ready';
      },
      error: () => {
        this.queueStatus = 'error';
      },
    });
  }

  private loadSource(key: OverviewSourceKey): void {
    this.sources[key] = { status: 'loading', data: [] };
    this.refreshDerived();
    this.fetchers[key]().subscribe({
      next: (data) => {
        this.sources[key] = { status: 'ready', data: data ?? [] };
        this.refreshDerived();
      },
      error: () => {
        this.sources[key] = { status: 'error', data: [] };
        this.refreshDerived();
      },
    });
  }

  private statusOf(keys: OverviewSourceKey[]): SourceStatus {
    const states = keys.map((key) => this.sources[key].status);
    if (states.includes('error')) return 'error';
    if (states.includes('loading')) return 'loading';
    return 'ready';
  }

  private refreshDerived(): void {
    const data = {
      users: this.sources.users.data,
      appScopes: this.sources.appScopes.data,
      configs: this.sources.configs.data as AppConfiguration[],
      communities: this.sources.communities.data as CommunityDto[],
      cities: this.sources.cities.data as CommunityDto[],
      products: this.sources.products.data,
      orders: this.sources.orders.data as Order[],
      appointments: this.sources.appointments.data as { status?: string }[],
    };
    this.metrics = this.buildMetrics(data).map((metric) => {
      const status = this.statusOf(metric.sources);
      return {
        ...metric,
        status,
        detail:
          status === 'error'
            ? 'This source could not be loaded. The value is unknown, not zero.'
            : metric.detail,
      };
    });
    this.attentionItems = this.buildAttentionItems(
      data.configs,
      data.orders,
      data.appointments,
      data.communities,
      data.cities
    ).map((item) => {
      const status = this.statusOf(item.sources);
      return {
        ...item,
        status,
        detail:
          status === 'error'
            ? 'Unavailable. A data source failed to load.'
            : status === 'loading'
            ? 'Loading…'
            : item.detail,
      };
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
        key: 'profiles',
        sources: ['users', 'appScopes'],
        status: 'ready',
        label: 'Governed Profiles',
        value: String(data.users.length),
        detail: `${data.appScopes.length} app scopes currently define access boundaries.`,
      },
      {
        key: 'experiences',
        sources: ['configs'],
        status: 'ready',
        label: 'Published Experiences',
        value: String(data.configs.filter((config) => config.active).length),
        detail: `${data.configs.length} total app configurations are available to operators.`,
      },
      {
        key: 'commerce',
        sources: ['products', 'orders'],
        status: 'ready',
        label: 'Commerce Surfaces',
        value: String(data.products.length),
        detail: `${data.orders.length} orders are currently visible for operator review.`,
      },
      {
        key: 'communities',
        sources: ['communities', 'cities'],
        status: 'ready',
        label: 'Communities',
        value: String(data.communities.length),
        detail: `${data.cities.length} city-locality records are tracked in the network.`,
      },
      {
        key: 'appointments',
        sources: ['appointments'],
        status: 'ready',
        label: 'Service Appointments',
        value: String(data.appointments.length),
        detail:
          'Bookings and availability controls remain under direct operator review.',
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
    const openOrders = orders.filter(
      (order) =>
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
        key: 'experience',
        sources: ['configs'],
        status: 'ready',
        title: 'Experience changes waiting on publish review',
        detail:
          draftConfigs > 0
            ? `${draftConfigs} configurations are still inactive or draft.`
            : 'All known application configurations are currently active.',
        route: '/dashboard/app-config',
      },
      {
        key: 'commerce',
        sources: ['orders'],
        status: 'ready',
        title: 'Commerce exceptions',
        detail:
          openOrders > 0
            ? `${openOrders} orders still appear actionable from the current dataset.`
            : 'No actionable orders detected from the current order snapshot.',
        route: '/dashboard/store/orders',
      },
      {
        key: 'booking',
        sources: ['appointments'],
        status: 'ready',
        title: 'Booking follow-up',
        detail:
          pendingAppointments > 0
            ? `${pendingAppointments} appointments still require approval or scheduling.`
            : 'No pending appointment approvals were detected.',
        route: '/dashboard/store/appointments',
      },
      {
        key: 'coverage',
        sources: ['communities', 'cities'],
        status: 'ready',
        title: 'Community coverage',
        detail: `${communities.length} communities are spread across ${cities.length} city records.`,
        route: '/dashboard/communities',
      },
    ];
  }
}
