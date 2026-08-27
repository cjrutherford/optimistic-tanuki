import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import {
  OWNER_CONSOLE_MUTATION_MATRIX,
  OwnerConsoleMutationMatrixEntry,
} from '../owner-console-mutation-matrix';
import {
  OWNER_CONSOLE_SLICE_7_PROJECTED_SCORE_IMPACT,
  OWNER_CONSOLE_SLICE_TRACKER,
  OwnerConsoleScoreImpactEntry,
  OwnerConsoleSliceTrackerEntry,
} from '../owner-console-roadmap';
import { OPERATOR_WORKSPACES } from '../operator-workspaces';
import { AppConfigService } from '../services/app-config.service';
import { AppScopesService } from '../services/app-scopes.service';
import { BusinessSiteAdminService } from '../services/business-site-admin.service';
import { CommunityService } from '../services/community.service';
import {
  ControlCenterService,
  DeploymentHealth,
  ImageInfo,
  OAuthProviderDetail,
} from '../services/control-center.service';
import {
  OperatorQueueDomain,
  OperatorQueueItem,
  OperatorQueueService,
} from '../services/operator-queue.service';
import { ContactLeadsService } from '../services/contact-leads.service';
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

interface MatrixWorkspaceCard {
  workspace: OwnerConsoleMutationMatrixEntry['workspace'];
  route: string;
  status: 'Healthy' | 'Attention';
  completionPercent: number;
  completeCount: number;
  totalCount: number;
  gapCount: number;
  detail: string;
}

interface SliceTrackerCard extends OwnerConsoleSliceTrackerEntry {
  statusTone: 'complete' | 'in-progress' | 'not-started' | 'blocked';
}

interface BusinessSiteCatalogStatus {
  status: 'Healthy' | 'Attention';
  mode: 'manual' | 'store' | 'unknown';
  detail: string;
  route: string;
}

@Component({
  selector: 'app-operations-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <section class="operations-page">
      <header class="hero">
        <p class="hero-kicker">Operations Workspace</p>
        <h1>Operational visibility and intervention</h1>
        <p>
          Use this workspace to monitor platform domains, identify attention
          areas, and jump directly into the tools that support operator
          intervention.
        </p>
      </header>

      <section class="panel">
        <div class="panel-heading">
          <h2>Domain status</h2>
          <p>
            Current status is derived from the operator data sources available
            today.
          </p>
        </div>
        <div class="status-grid">
          @for (card of statusCards; track card.title) {
          <a class="status-card" [routerLink]="card.route">
            <span
              class="status-badge"
              [class.attention]="card.status === 'Attention'"
            >
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
          <p>
            These entry points concentrate the workflows platform owners use to
            intervene.
          </p>
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
          <h2>Operator queue</h2>
          <p>
            Cross-domain actionable work, with filters for triage before jumping
            into domain tools.
          </p>
        </div>

        <div class="queue-filters">
          <label>
            <span>Domain</span>
            <select [(ngModel)]="selectedQueueDomain">
              <option value="all">All domains</option>
              @for (domain of queueDomains; track domain) {
              <option [value]="domain">{{ domain }}</option>
              }
            </select>
          </label>
          <label>
            <span>Severity</span>
            <select [(ngModel)]="selectedQueueSeverity">
              <option value="all">All severities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
        </div>

        <div class="queue-summary" *ngIf="queueItems.length > 0">
          <span class="queue-count">{{ filteredQueueItems.length }} items</span>
          @for (domain of queueDomains; track domain) {
          <span
            class="queue-domain-chip"
            *ngIf="countQueueItemsByDomain(domain) > 0"
          >
            {{ domain }} · {{ countQueueItemsByDomain(domain) }}
          </span>
          }
        </div>

        <div
          class="queue-grid"
          *ngIf="filteredQueueItems.length > 0; else noQueueItems"
        >
          @for (item of filteredQueueItems; track item.id) {
          <a class="queue-card" [routerLink]="item.route">
            <div class="queue-card__header">
              <span
                class="queue-severity"
                [class.high]="item.severity === 'high'"
                [class.medium]="item.severity === 'medium'"
              >
                {{ item.severity }}
              </span>
              <span class="queue-domain">{{ item.domain }}</span>
            </div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.detail }}</p>
          </a>
          }
        </div>

        <ng-template #noQueueItems>
          <p class="empty-copy">
            No operator queue items matched the current filters.
          </p>
        </ng-template>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <h2>Business-site catalog linkage</h2>
          <p>
            Track whether the public business site is running against manual
            offers or the store service catalog.
          </p>
        </div>
        <a class="status-card" [routerLink]="businessSiteCatalogStatus.route">
          <span
            class="status-badge"
            [class.attention]="businessSiteCatalogStatus.status === 'Attention'"
          >
            {{ businessSiteCatalogStatus.status }}
          </span>
          <h3>Catalog mode: {{ businessSiteCatalogStatus.mode }}</h3>
          <p>{{ businessSiteCatalogStatus.detail }}</p>
        </a>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <h2>Deployment health</h2>
          <p>Platform infrastructure and configuration status.</p>
        </div>
        @if (deploymentHealth; as health) {
        <div class="health-grid">
          <div class="health-item">
            <span class="health-label">Config</span>
            <span
              class="health-value"
              [class.attention]="health.configStatus === 'pending-changes'"
            >
              {{
                health.configStatus === 'current'
                  ? 'Current'
                  : 'Pending changes'
              }}
            </span>
          </div>
          <div class="health-item">
            <span class="health-label">Infrastructure</span>
            <span class="health-value">{{ health.infrastructure }}</span>
          </div>
          <div class="health-item">
            <span class="health-label">Database</span>
            <span class="health-value">{{ health.databaseReadiness }}</span>
          </div>
          <div class="health-item">
            <span class="health-label">Secrets</span>
            <span class="health-value">{{ health.secretsHealth }}</span>
          </div>
          @if (health.lastDeployed) {
          <div class="health-item">
            <span class="health-label">Last deployed</span>
            <span class="health-value"
              >{{ health.lastDeployed.tag }} ({{
                health.lastDeployed.result
              }})</span
            >
          </div>
          }
        </div>
        }
      </section>

      <section class="panel">
        <div class="panel-heading">
          <h2>Image freshness</h2>
          <p>
            @if (updatesAvailable > 0) {
            <span class="attention-count"
              >{{ updatesAvailable }} service(s) with updates available</span
            >
            } @else {
            <span>All services are up to date.</span>
            }
          </p>
        </div>
        <div class="images-grid">
          @for (img of images; track img.serviceId) {
          <div
            class="image-item"
            [class.update-available]="img.updateAvailable"
          >
            <span class="image-name">{{ img.serviceId }}</span>
            <span class="image-tag">{{ img.currentTag }}</span>
            @if (img.updateAvailable) {
            <span class="update-badge">Update available</span>
            }
          </div>
          }
        </div>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <h2>OAuth health</h2>
          <p>Identity provider status across the platform.</p>
        </div>
        <div class="oauth-summary">
          @for (provider of oauthProviders; track provider.name) {
          <div class="oauth-provider-summary">
            <span class="provider-name">{{ provider.name }}</span>
            <span
              class="badge"
              [class.badge-success]="provider.status === 'configured'"
              [class.badge-warning]="provider.status === 'pending'"
              [class.badge-error]="provider.status === 'error'"
            >
              {{ provider.status }}
            </span>
          </div>
          }
        </div>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <h2>Mutation coverage matrix</h2>
          <p>
            This matrix tracks every owner-console write flow by workspace,
            route, backend endpoint, and expected permission boundary.
          </p>
        </div>
        <div class="coverage-grid">
          @for (card of matrixStatusCards; track card.label) {
          <article
            class="coverage-card"
            [class.partial]="card.tone === 'partial'"
            [class.missing]="card.tone === 'missing'"
          >
            <span class="coverage-count">{{ card.count }}</span>
            <h3>{{ card.label }}</h3>
          </article>
          }
        </div>
        <div class="workspace-coverage-grid">
          @for (card of matrixWorkspaceCards; track card.workspace) {
          <a
            class="coverage-card coverage-card--workspace"
            [routerLink]="card.route"
          >
            <span
              class="status-badge"
              [class.attention]="card.status === 'Attention'"
            >
              {{ card.status }}
            </span>
            <div class="workspace-coverage-head">
              <h3>{{ card.workspace }}</h3>
              <strong>{{ card.completionPercent }}%</strong>
            </div>
            <p>{{ card.detail }}</p>
            <span class="workspace-coverage-meta">
              {{ card.completeCount }}/{{ card.totalCount }} complete ·
              {{ card.gapCount }} gap{{ card.gapCount === 1 ? '' : 's' }}
            </span>
          </a>
          }
        </div>
        <div class="gap-list">
          @for (entry of incompleteMatrixEntries; track entry.feature) {
          <article class="gap-card">
            <div class="gap-header">
              <span
                class="gap-status"
                [class.missing]="entry.status === 'missing'"
              >
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

      <section class="panel">
        <div class="panel-heading">
          <h2>Slice tracker</h2>
          <p>
            Track implementation progress across the owner-console improvement
            roadmap without leaving operations.
          </p>
        </div>
        <div class="slice-grid">
          @for (card of sliceTrackerCards; track card.slice) {
          <article class="slice-card">
            <div class="slice-card__header">
              <span class="slice-number">Slice {{ card.slice }}</span>
              <span
                class="gap-status"
                [class.missing]="card.status === 'blocked'"
              >
                {{ card.status }}
              </span>
            </div>
            <h3>{{ card.name }}</h3>
            <p>{{ card.expectedOutcome }}</p>
            <div class="slice-meta">
              <span>Priority {{ card.priority }}</span>
              <span>{{ card.primaryDomains.join(', ') }}</span>
            </div>
          </article>
          }
        </div>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <h2>Projected score impact</h2>
          <p>
            Estimated UX, completeness, and practicality movement for the
            current Slice 7 roadmap work.
          </p>
        </div>
        <div class="score-impact-grid">
          @for (card of projectedScoreImpactCards; track card.domain) {
          <article class="score-impact-card">
            <h3>{{ card.domain }}</h3>
            <div class="score-impact-metrics">
              <span>UX +{{ card.uxDelta.toFixed(1) }}</span>
              <span>Completeness +{{ card.completenessDelta.toFixed(1) }}</span>
              <span>Practicality +{{ card.practicalityDelta.toFixed(1) }}</span>
            </div>
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
        background: radial-gradient(
            circle at top left,
            color-mix(in srgb, var(--warning) 12%, transparent),
            transparent 30%
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
        color: color-mix(in srgb, var(--warning) 82%, var(--foreground));
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
      .coverage-grid,
      .workspace-coverage-grid,
      .queue-grid,
      .slice-grid,
      .score-impact-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 16px;
      }

      .status-card,
      .action-card,
      .coverage-card,
      .gap-card,
      .queue-card {
        display: grid;
        gap: 10px;
        padding: 20px;
        border-radius: 18px;
        border: 1px solid var(--border-color, #d6d6d6);
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 92%,
          transparent
        );
        color: inherit;
      }

      .status-card,
      .action-card,
      .queue-card {
        text-decoration: none;
      }

      .queue-filters {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        margin-bottom: 16px;
      }

      .queue-filters label {
        display: grid;
        gap: 8px;
      }

      .queue-filters select {
        min-width: 180px;
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 10px;
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 92%,
          transparent
        );
        padding: 10px 12px;
        font: inherit;
        color: var(--foreground, #111827);
      }

      .queue-summary {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 16px;
      }

      .queue-count,
      .queue-domain-chip,
      .queue-severity,
      .queue-domain {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 0.78rem;
        font-weight: 700;
      }

      .queue-count,
      .queue-domain-chip,
      .queue-domain {
        background: color-mix(in srgb, var(--warning) 12%, transparent);
        color: color-mix(in srgb, var(--warning) 82%, var(--foreground));
      }

      .queue-card__header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }

      .queue-severity {
        background: color-mix(in srgb, var(--danger) 12%, transparent);
        color: color-mix(in srgb, var(--danger) 82%, var(--foreground));
        text-transform: uppercase;
      }

      .queue-severity.medium {
        background: color-mix(in srgb, var(--warning) 12%, transparent);
        color: color-mix(in srgb, var(--warning) 82%, var(--foreground));
      }

      .queue-severity.high {
        background: color-mix(in srgb, var(--danger) 12%, transparent);
        color: color-mix(in srgb, var(--danger) 82%, var(--foreground));
      }

      .empty-copy {
        margin: 0;
        color: var(--foreground-secondary, #666);
      }

      .status-badge {
        width: fit-content;
        border-radius: 999px;
        padding: 4px 10px;
        background: color-mix(in srgb, var(--success) 14%, transparent);
        color: color-mix(in srgb, var(--success) 82%, var(--foreground));
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      .status-badge.attention {
        background: color-mix(in srgb, var(--warning) 16%, transparent);
        color: color-mix(in srgb, var(--warning) 82%, var(--foreground));
      }

      .coverage-card {
        align-content: start;
      }

      .coverage-card--workspace {
        text-decoration: none;
      }

      .coverage-card.partial {
        background: color-mix(in srgb, var(--warning) 8%, transparent);
      }

      .coverage-card.missing {
        background: color-mix(in srgb, var(--danger) 8%, transparent);
      }

      .coverage-count {
        font-size: 2rem;
        font-weight: 700;
        color: color-mix(in srgb, var(--warning) 82%, var(--foreground));
      }

      .workspace-coverage-grid {
        margin-top: 16px;
      }

      .workspace-coverage-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
      }

      .workspace-coverage-meta {
        font-size: 0.82rem;
        color: var(--foreground-secondary, #666);
      }

      .slice-card,
      .score-impact-card {
        display: grid;
        gap: 12px;
        padding: 20px;
        border-radius: 18px;
        border: 1px solid var(--border-color, #d6d6d6);
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 92%,
          transparent
        );
      }

      .slice-card__header,
      .slice-meta,
      .score-impact-metrics {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .slice-number,
      .slice-meta span,
      .score-impact-metrics span {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 0.78rem;
        font-weight: 700;
        background: color-mix(in srgb, var(--warning) 12%, transparent);
        color: color-mix(in srgb, var(--warning) 82%, var(--foreground));
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
        background: color-mix(in srgb, var(--warning) 16%, transparent);
        color: color-mix(in srgb, var(--warning) 82%, var(--foreground));
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      .gap-status.missing {
        background: color-mix(in srgb, var(--danger) 16%, transparent);
        color: color-mix(in srgb, var(--danger) 82%, var(--foreground));
      }

      .health-grid,
      .images-grid,
      .oauth-summary {
        display: grid;
        gap: 12px;
        margin-top: 12px;
      }

      .health-grid {
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }

      .health-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 12px;
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 12px;
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 84%,
          transparent
        );
      }

      .health-label {
        font-size: 0.78rem;
        color: var(--foreground-secondary, #666);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .health-value {
        font-weight: 600;
      }

      .health-value.attention {
        color: color-mix(in srgb, var(--warning) 82%, var(--foreground));
      }

      .images-grid {
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      }

      .image-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px;
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 10px;
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 84%,
          transparent
        );
      }

      .image-item.update-available {
        border-color: color-mix(in srgb, var(--warning) 68%, var(--border));
        background: color-mix(in srgb, var(--warning) 8%, transparent);
      }

      .image-name {
        font-weight: 600;
      }

      .image-tag {
        font-family: monospace;
        font-size: 0.85rem;
        color: var(--foreground-secondary, #666);
      }

      .update-badge {
        margin-left: auto;
        font-size: 0.72rem;
        padding: 2px 8px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--warning) 16%, transparent);
        color: color-mix(in srgb, var(--warning) 82%, var(--foreground));
        font-weight: 700;
      }

      .oauth-summary {
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }

      .oauth-provider-summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px;
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 10px;
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 84%,
          transparent
        );
      }

      .provider-name {
        font-weight: 600;
        text-transform: capitalize;
      }

      .badge {
        font-size: 0.72rem;
        padding: 2px 8px;
        border-radius: 999px;
        font-weight: 700;
      }

      .badge-success {
        background: color-mix(in srgb, var(--success) 14%, transparent);
        color: color-mix(in srgb, var(--success) 82%, var(--foreground));
      }

      .badge-warning {
        background: color-mix(in srgb, var(--warning) 16%, transparent);
        color: color-mix(in srgb, var(--warning) 82%, var(--foreground));
      }

      .badge-error {
        background: color-mix(in srgb, var(--danger) 14%, transparent);
        color: color-mix(in srgb, var(--danger) 82%, var(--foreground));
      }

      .attention-count {
        font-weight: 600;
        color: color-mix(in srgb, var(--warning) 82%, var(--foreground));
      }
    `,
  ],
})
export class OperationsWorkspaceComponent implements OnInit {
  private readonly usersService = inject(UsersService);
  private readonly appScopesService = inject(AppScopesService);
  private readonly appConfigService = inject(AppConfigService);
  private readonly businessSiteAdminService = inject(BusinessSiteAdminService);
  private readonly communityService = inject(CommunityService);
  private readonly storeService = inject(StoreService);
  private readonly controlCenter = inject(ControlCenterService);
  private readonly operatorQueueService = inject(OperatorQueueService);
  private readonly contactLeadsService = inject(ContactLeadsService);

  statusCards: DomainStatusCard[] = [];
  queueItems: OperatorQueueItem[] = [];
  readonly queueDomains: OperatorQueueDomain[] = [
    'Governance',
    'Experience',
    'Commerce',
    'CRM',
    'Community Ops',
  ];
  selectedQueueDomain: OperatorQueueDomain | 'all' = 'all';
  selectedQueueSeverity: OperatorQueueItem['severity'] | 'all' = 'all';
  matrixStatusCards: MatrixStatusCard[] = [];
  matrixWorkspaceCards: MatrixWorkspaceCard[] = [];
  sliceTrackerCards: SliceTrackerCard[] = [];
  projectedScoreImpactCards: OwnerConsoleScoreImpactEntry[] = [];
  incompleteMatrixEntries: OwnerConsoleMutationMatrixEntry[] = [];
  businessSiteCatalogStatus: BusinessSiteCatalogStatus = {
    status: 'Attention',
    mode: 'unknown',
    detail: 'Business-site catalog configuration has not been loaded yet.',
    route: '/dashboard/store/business-site',
  };
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
      title: 'Govern business-site catalog source',
      description:
        'Verify store service-product readiness before switching the public business site to store-backed offers.',
      route: '/dashboard/store/business-site',
    },
    {
      title: 'Stabilize community rollout',
      description:
        'Inspect city and community records whenever localized network coverage needs operator action.',
      route: '/dashboard/communities',
    },
    {
      title: 'Monitor video processing',
      description:
        'Watch transcoding queue health, inspect failures, and safely retry failed video jobs.',
      route: '/dashboard/video-processing',
    },
  ];

  deploymentHealth: DeploymentHealth = {
    configStatus: 'current',
    infrastructure: 'not-provisioned',
    databaseReadiness: 'all-slots-ready',
    secretsHealth: 'all-keys-present',
  };
  images: ImageInfo[] = [];
  oauthProviders: OAuthProviderDetail[] = [];
  updatesAvailable = 0;

  get filteredQueueItems(): OperatorQueueItem[] {
    return this.queueItems.filter((item) => {
      const domainMatch =
        this.selectedQueueDomain === 'all' ||
        item.domain === this.selectedQueueDomain;
      const severityMatch =
        this.selectedQueueSeverity === 'all' ||
        item.severity === this.selectedQueueSeverity;
      return domainMatch && severityMatch;
    });
  }

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
    this.matrixWorkspaceCards = this.buildMatrixWorkspaceCards();
    this.sliceTrackerCards = OWNER_CONSOLE_SLICE_TRACKER.map((entry) => ({
      ...entry,
      statusTone: entry.status,
    }));
    this.projectedScoreImpactCards =
      OWNER_CONSOLE_SLICE_7_PROJECTED_SCORE_IMPACT;

    this.controlCenter.getDeploymentHealth().subscribe((health) => {
      this.deploymentHealth = health;
    });
    this.controlCenter.getImages().subscribe((imgs) => {
      this.images = imgs;
      this.updatesAvailable = imgs.filter((img) => img.updateAvailable).length;
    });
    this.controlCenter.getOAuthProviders().subscribe((data) => {
      this.oauthProviders = data.providers;
    });
    this.operatorQueueService.getOverviewQueue().subscribe((items) => {
      this.queueItems = items;
    });

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
        products: this.storeService
          .getProducts()
          .pipe(catchError(() => of(null))),
        orders: this.storeService.getOrders().pipe(catchError(() => of(null))),
        appointments: this.storeService
          .getAppointments()
          .pipe(catchError(() => of(null))),
        businessSiteConfig: this.businessSiteAdminService
          .getSiteConfig()
          .pipe(catchError(() => of(null))),
      }),
      crm: this.contactLeadsService.getLeads().pipe(catchError(() => of(null))),
      communities: forkJoin({
        communities: this.communityService
          .getCommunities()
          .pipe(catchError(() => of(null))),
        cities: this.communityService
          .getCities()
          .pipe(catchError(() => of(null))),
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
          title: 'CRM pipeline',
          status: result.crm ? 'Healthy' : 'Attention',
          detail: result.crm
            ? 'Lead intake data is available for assignment, follow-up, and response work.'
            : 'Lead intake data is unavailable and CRM interventions need investigation.',
          route: '/dashboard/crm',
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

      const catalogSource =
        result.commerce.businessSiteConfig?.config?.serviceCatalog?.source ??
        'manual';
      const serviceProducts =
        result.commerce.products?.filter(
          (product) => product.type === 'service'
        ) ?? [];
      this.businessSiteCatalogStatus = {
        status:
          result.commerce.businessSiteConfig && result.commerce.products
            ? 'Healthy'
            : 'Attention',
        mode:
          catalogSource === 'store' || catalogSource === 'manual'
            ? catalogSource
            : 'unknown',
        detail:
          result.commerce.businessSiteConfig && result.commerce.products
            ? catalogSource === 'store'
              ? `Store-backed business offers are enabled. ${serviceProducts.length} service product(s) are available in the current catalog.`
              : 'Manual business-site offers are active. Store service products are available, but not currently selected as the public source.'
            : 'Business-site or store catalog data is unavailable and should be investigated.',
        route: '/dashboard/store/business-site',
      };
    });
  }

  countQueueItemsByDomain(domain: OperatorQueueDomain): number {
    return this.filteredQueueItems.filter((item) => item.domain === domain)
      .length;
  }

  private buildMatrixWorkspaceCards(): MatrixWorkspaceCard[] {
    const workspaceOrder: OwnerConsoleMutationMatrixEntry['workspace'][] = [
      'Governance',
      'Experience',
      'Commerce',
      'CRM',
      'Community Ops',
    ];

    return workspaceOrder.map((workspace) => {
      const entries = OWNER_CONSOLE_MUTATION_MATRIX.filter(
        (entry) => entry.workspace === workspace
      );
      const completeCount = entries.filter(
        (entry) => entry.status === 'complete'
      ).length;
      const gapCount = entries.length - completeCount;
      const completionPercent =
        entries.length === 0
          ? 0
          : Math.round((completeCount / entries.length) * 100);

      return {
        workspace,
        route: this.resolveWorkspaceRoute(workspace),
        status: gapCount === 0 ? 'Healthy' : 'Attention',
        completionPercent,
        completeCount,
        totalCount: entries.length,
        gapCount,
        detail:
          gapCount === 0
            ? 'All tracked write flows in this workspace are marked complete.'
            : `${gapCount} tracked write flow${
                gapCount === 1 ? '' : 's'
              } still need completion or remediation coverage.`,
      };
    });
  }

  private resolveWorkspaceRoute(
    workspace: OwnerConsoleMutationMatrixEntry['workspace']
  ): string {
    const config = OPERATOR_WORKSPACES.find(
      (candidate) => candidate.label === workspace
    );
    return config ? `/dashboard/${config.path}` : '/dashboard/operations';
  }
}
