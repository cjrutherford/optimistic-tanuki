import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  MetricTileComponent,
  SectionHeadingComponent,
} from '@optimistic-tanuki/common-ui';
import { MarketingStateService } from '../services/marketing-state.service';

@Component({
  selector: 'app-offers-page',
  imports: [
    CommonModule,
    RouterLink,
    MetricTileComponent,
    SectionHeadingComponent,
  ],
  template: `
    <section class="offers-shell">
      <article class="hero-card">
        <span class="eyebrow">Offer workspaces</span>
        <h1>Generate coordinated asset bundles around a single offer.</h1>
        <p>
          Each workspace keeps the offer brief, generated bundle directions,
          saved versions, and export-ready assets together. Start from a preset
          offer or define a custom one, then move into a dedicated bundle
          workspace.
        </p>
        <div class="hero-actions">
          <a class="cta primary" routerLink="/offers/new"
            >Start a new offer brief</a
          >
          <a class="cta secondary" routerLink="/"
            >Review the product overview</a
          >
        </div>
      </article>

      <section class="metric-strip">
        <otui-metric-tile
          label="Offer Workspaces"
          [value]="workspaceStatus().workspaceCount"
          caption="saved offer contexts"
        ></otui-metric-tile>
        <otui-metric-tile
          label="Saved Versions"
          [value]="workspaceStatus().currentVersionCount"
          caption="in the active workspace"
        ></otui-metric-tile>
        <otui-metric-tile
          label="Bundle Directions"
          [value]="workspaceStatus().conceptCount"
          caption="available in the active workspace"
        ></otui-metric-tile>
      </section>

      <section class="workspace-stack">
        <otui-section-heading
          eyebrow="Saved work"
          heading="Open an offer workspace or launch a new bundle brief."
        ></otui-section-heading>

        <div
          class="workspace-grid"
          *ngIf="workspaces().length; else emptyState"
        >
          <article
            class="workspace-card"
            *ngFor="let workspace of workspaces()"
            [class.active]="workspace.id === currentWorkspaceId()"
          >
            <div class="card-head">
              <div>
                <span class="eyebrow">Offer workspace</span>
                <h2>{{ workspace.name }}</h2>
              </div>
              <span
                class="status-pill"
                *ngIf="workspace.id === currentWorkspaceId()"
                >Active</span
              >
            </div>
            <dl class="workspace-meta">
              <div>
                <dt>Bundle directions</dt>
                <dd>{{ workspace.concepts.length }}</dd>
              </div>
              <div>
                <dt>Saved versions</dt>
                <dd>{{ workspace.versions.length }}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{{ workspace.updatedAt | date : 'mediumDate' }}</dd>
              </div>
            </dl>
            <div class="workspace-actions">
              <a class="cta primary" [routerLink]="['/offers', workspace.id]"
                >Open bundle workspace</a
              >
            </div>
          </article>
        </div>

        <ng-template #emptyState>
          <article class="empty-card">
            <h2>No offer workspaces yet.</h2>
            <p>
              Start a brief to generate your first coordinated asset bundle.
            </p>
            <a class="cta primary" routerLink="/offers/new"
              >Start a new offer brief</a
            >
          </article>
        </ng-template>
      </section>
    </section>
  `,
  styles: [
    `
      .offers-shell,
      .workspace-stack {
        display: grid;
        gap: 1rem;
      }

      .hero-card,
      .workspace-card,
      .empty-card {
        border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
        border-radius: var(--border-radius-lg, 20px);
        background: color-mix(
          in srgb,
          var(--surface, #10151c) 90%,
          transparent
        );
        box-shadow: var(--shadow-lg, 0 18px 60px rgba(0, 0, 0, 0.25));
      }

      .hero-card,
      .workspace-card,
      .empty-card {
        padding: 1.4rem;
      }

      .hero-card h1,
      .workspace-card h2,
      .empty-card h2 {
        margin: 0.4rem 0 0.8rem;
        font-family: var(--font-heading, 'Instrument Serif', serif);
        font-weight: 500;
        line-height: 0.98;
        text-wrap: balance;
      }

      .hero-card h1 {
        font-size: clamp(2.8rem, 6vw, 4.9rem);
        max-width: 10ch;
      }

      .hero-card p,
      .empty-card p {
        color: var(--muted, rgba(255, 255, 255, 0.72));
        line-height: 1.65;
        max-width: 60ch;
      }

      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: var(--primary, #d97706);
        font-size: 0.72rem;
      }

      .hero-actions,
      .workspace-actions {
        display: flex;
        gap: 0.85rem;
        flex-wrap: wrap;
        margin-top: 1.1rem;
      }

      .metric-strip,
      .workspace-grid {
        display: grid;
        gap: 1rem;
      }

      .metric-strip {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .workspace-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .workspace-card.active {
        border-color: color-mix(
          in srgb,
          var(--primary, #d97706) 55%,
          transparent
        );
        background: color-mix(
          in srgb,
          var(--primary, #d97706) 10%,
          var(--surface, #10151c)
        );
      }

      .card-head {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: flex-start;
      }

      .status-pill {
        display: inline-flex;
        padding: 0.35rem 0.65rem;
        border-radius: 999px;
        background: color-mix(
          in srgb,
          var(--primary, #d97706) 16%,
          transparent
        );
        color: var(--primary, #d97706);
      }

      .workspace-meta {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.85rem;
        margin: 1rem 0 0;
      }

      .workspace-meta dt {
        color: var(--muted, rgba(255, 255, 255, 0.72));
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .workspace-meta dd {
        margin: 0.25rem 0 0;
        font-size: 1.05rem;
      }

      .cta {
        text-decoration: none;
        padding: 0.85rem 1.1rem;
        border-radius: 999px;
        border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
      }

      .primary {
        color: var(--background, #081018);
        background: var(
          --primary-gradient,
          linear-gradient(135deg, #d97706, #2563eb)
        );
        border-color: transparent;
      }

      .secondary {
        color: var(--foreground, #f7f1e6);
        background: color-mix(in srgb, var(--foreground, #fff) 6%, transparent);
      }

      @media (max-width: 980px) {
        .metric-strip,
        .workspace-grid,
        .workspace-meta {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class OffersPageComponent {
  private readonly state = inject(MarketingStateService);

  protected readonly workspaces = computed(() =>
    typeof (this.state as { workspaces?: unknown }).workspaces === 'function'
      ? (this.state as { workspaces: () => Array<any> }).workspaces()
      : []
  );
  protected readonly currentWorkspaceId = computed(() =>
    typeof (this.state as { currentWorkspaceId?: unknown })
      .currentWorkspaceId === 'function'
      ? (
          this.state as { currentWorkspaceId: () => string }
        ).currentWorkspaceId()
      : ''
  );
  protected readonly workspaceStatus = computed(() =>
    typeof (this.state as { workspaceStatus?: unknown }).workspaceStatus ===
    'function'
      ? (
          this.state as {
            workspaceStatus: () => {
              workspaceCount: number;
              currentVersionCount: number;
              conceptCount: number;
            };
          }
        ).workspaceStatus()
      : {
          workspaceCount: this.workspaces().length,
          currentVersionCount: 0,
          conceptCount: 0,
        }
  );
}
