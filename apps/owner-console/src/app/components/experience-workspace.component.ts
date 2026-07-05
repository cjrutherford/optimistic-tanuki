import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AppConfigService } from '../services/app-config.service';
import { ControlCenterService } from '../services/control-center.service';
import { RegistryManagementService } from '../services/registry-management.service';

interface ExperienceStatusCard {
  title: string;
  status: 'Healthy' | 'Attention';
  detail: string;
  route: string;
}

interface ExperienceTimelineItem {
  surface: 'App Config' | 'Registry' | 'Rollout';
  title: string;
  detail: string;
  occurredAt: string;
  route: string;
}

@Component({
  selector: 'app-experience-workspace',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <section class="experience-page">
      <header class="hero">
        <p class="hero-kicker">Experience Workspace</p>
        <h1>Release orchestration</h1>
        <p>
          Review app configuration, theme, registry, and rollout state from one
          operator surface before publishing or rolling back experience changes.
        </p>
      </header>

      <section class="panel">
        <div class="panel-heading">
          <h2>Release readiness</h2>
          <p>
            Cross-surface status for the current experience release posture.
          </p>
        </div>
        <div class="status-grid">
          @for (card of releaseStatusCards; track card.title) {
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
          <h2>Cross-surface release timeline</h2>
          <p>
            Recent published revisions and rollout activity to support safer
            release and rollback decisions.
          </p>
        </div>
        <div class="timeline">
          @for (item of releaseTimelineItems; track item.surface + item.title +
          item.occurredAt) {
          <a class="timeline-item" [routerLink]="item.route">
            <strong>{{ item.surface }} · {{ item.title }}</strong>
            <span>{{ item.detail }}</span>
            <small>{{ item.occurredAt | date : 'medium' }}</small>
          </a>
          }
        </div>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <h2>Rollback guidance</h2>
          <p>
            Use the correct surface based on which artifact introduced the
            regression.
          </p>
        </div>
        <div class="status-grid">
          <a class="status-card" routerLink="/dashboard/app-config">
            <h3>Configuration rollback</h3>
            <p>
              Use app configuration history when layout, routes, or feature
              flags regress.
            </p>
          </a>
          <a class="status-card" routerLink="/dashboard/theme">
            <h3>Theme rollback</h3>
            <p>
              Use theme history when personality, palette, or typography
              regress.
            </p>
          </a>
          <a class="status-card" routerLink="/dashboard/registry">
            <h3>Registry rollback</h3>
            <p>
              Use registry history when app visibility, domains, or navigation
              regress.
            </p>
          </a>
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

      .experience-page,
      .timeline {
        display: grid;
        gap: 20px;
      }

      .hero,
      .panel {
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 24px;
        padding: 24px;
        background: radial-gradient(
            circle at top left,
            color-mix(in srgb, var(--accent, #2563eb) 10%, transparent),
            transparent 32%
          ),
          color-mix(in srgb, var(--surface, #ffffff) 96%, transparent);
        color: var(--foreground, #111827);
      }

      .hero-kicker {
        margin: 0 0 8px;
        color: color-mix(
          in srgb,
          var(--accent, #2563eb) 82%,
          var(--foreground)
        );
        font-size: 0.82rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .panel-heading {
        margin-bottom: 16px;
      }

      .status-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 16px;
      }

      .status-card,
      .timeline-item {
        display: grid;
        gap: 8px;
        padding: 18px;
        border-radius: 18px;
        border: 1px solid var(--border-color, #d6d6d6);
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 92%,
          transparent
        );
        color: inherit;
        text-decoration: none;
      }

      .status-badge {
        width: fit-content;
        border-radius: 999px;
        padding: 4px 10px;
        background: color-mix(
          in srgb,
          var(--success, #15803d) 14%,
          transparent
        );
        color: color-mix(
          in srgb,
          var(--success, #15803d) 82%,
          var(--foreground)
        );
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      .status-badge.attention {
        background: color-mix(
          in srgb,
          var(--warning, #b45309) 16%,
          transparent
        );
        color: color-mix(
          in srgb,
          var(--warning, #b45309) 82%,
          var(--foreground)
        );
      }

      .timeline-item small {
        color: var(--foreground-secondary, #666);
      }
    `,
  ],
})
export class ExperienceWorkspaceComponent implements OnInit {
  private readonly appConfigService = inject(AppConfigService);
  private readonly registryService = inject(RegistryManagementService);
  private readonly controlCenterService = inject(ControlCenterService);

  releaseStatusCards: ExperienceStatusCard[] = [];
  releaseTimelineItems: ExperienceTimelineItem[] = [];

  ngOnInit(): void {
    forkJoin({
      configs: this.appConfigService.getConfigurations(),
      registry: this.registryService.getRegistry(),
      rolloutHistory: this.controlCenterService.getRolloutHistory(10),
    }).subscribe(({ configs, registry, rolloutHistory }) => {
      const draftConfigs = configs.filter(
        (config) => config.release?.status !== 'published'
      );
      const pendingThemes = configs.filter(
        (config) => config.release?.status !== 'published'
      );
      const registryStatus = registry.release?.status ?? 'draft';

      this.releaseStatusCards = [
        {
          title: 'App configurations',
          status: draftConfigs.length > 0 ? 'Attention' : 'Healthy',
          detail:
            draftConfigs.length > 0
              ? `${draftConfigs.length} configuration release(s) are still draft or pending publish.`
              : 'All tracked configurations are currently published.',
          route: '/dashboard/app-config',
        },
        {
          title: 'Theme releases',
          status: pendingThemes.length > 0 ? 'Attention' : 'Healthy',
          detail:
            pendingThemes.length > 0
              ? `${pendingThemes.length} theme payload(s) still need publish review.`
              : 'All tracked themes are currently published.',
          route: '/dashboard/theme',
        },
        {
          title: 'Application registry',
          status: registryStatus === 'published' ? 'Healthy' : 'Attention',
          detail:
            registryStatus === 'published'
              ? 'Registry release is currently published with rollback history available.'
              : 'Registry changes are pending publish or need operator review.',
          route: '/dashboard/registry',
        },
      ];

      this.releaseTimelineItems = [
        ...configs.flatMap((config) =>
          (config.release?.history ?? []).slice(0, 1).map((revision) => ({
            surface: 'App Config' as const,
            title: config.name,
            detail:
              revision.changeSummary ||
              revision.releaseNotes ||
              'Published configuration revision.',
            occurredAt:
              (revision as { publishedAt?: string }).publishedAt ??
              new Date().toISOString(),
            route: '/dashboard/app-config',
          }))
        ),
        ...((registry.release?.history ?? []).slice(0, 1).map((revision) => ({
          surface: 'Registry' as const,
          title: revision.releaseNotes || 'Registry release',
          detail:
            revision.changeSummary ||
            revision.releaseNotes ||
            'Published registry revision.',
          occurredAt:
            (revision as { publishedAt?: string }).publishedAt ??
            new Date().toISOString(),
          route: '/dashboard/registry',
        })) ?? []),
        ...rolloutHistory.slice(0, 3).map((rollout) => ({
          surface: 'Rollout' as const,
          title: `Rollout ${rollout.targetTag}`,
          detail: `${rollout.status} across ${rollout.services.length} service(s).`,
          occurredAt: rollout.completedAt || rollout.startedAt,
          route: '/dashboard/control-center',
        })),
      ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    });
  }
}
