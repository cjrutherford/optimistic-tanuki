import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import {
  FinCommanderOverview,
  FinCommanderPlanStore,
} from '@optimistic-tanuki/fin-commander-data-access';
import { PulseRingsComponent } from '@optimistic-tanuki/motion-ui';

@Component({
  selector: 'fc-overview-page',
  standalone: true,
  imports: [CommonModule, RouterLink, PulseRingsComponent],
  template: `
    @if (overview(); as activeOverview) {
    <section class="overview-grid">
      <!-- ── SPOTLIGHT ───────────────────────────────────────── -->
      <article class="spotlight-card">
        <div class="spotlight-bg">
          <otui-pulse-rings
            [height]="'100%'"
            [speed]="0.7"
            [intensity]="0.45"
          ></otui-pulse-rings>
        </div>

        <div class="spotlight-inner">
          <div class="spotlight-top">
            <span class="badge">Command Summary</span>
            <span class="live-indicator">
              <span class="live-dot"></span>Live
            </span>
          </div>

          <div class="spotlight-metrics">
            <div class="metric-block">
              <span class="metric-number">{{
                activeOverview.goals.length
              }}</span>
              <span class="metric-label">Active Goals</span>
            </div>
            <div class="metric-divider"></div>
            <div class="metric-block">
              <span class="metric-number">{{
                activeOverview.scenarios.length
              }}</span>
              <span class="metric-label">Scenarios</span>
            </div>
            <div class="metric-divider"></div>
            <div class="metric-block">
              <span class="metric-number">{{
                activeOverview.workspaces.length
              }}</span>
              <span class="metric-label">Workspaces</span>
            </div>
          </div>

          <p class="spotlight-desc">
            Keep your next money moves, tradeoffs, and workspace rollups in one
            planning view.
          </p>
        </div>
      </article>

      <!-- ── WORKSPACE CARDS ─────────────────────────────────── -->
      @for (workspace of activeOverview.workspaces; track workspace.workspace;
      let i = $index) {
      <article
        class="workspace-card"
        [class.empty]="!workspace.available"
        [attr.data-workspace]="workspace.workspace"
        [style.animation-delay]="i * 0.07 + 0.1 + 's'"
      >
        <div class="card-header">
          <span class="workspace-icon-wrap">
            <span class="workspace-icon">{{
              getWorkspaceIcon(workspace.workspace)
            }}</span>
          </span>
          <div class="card-header-text">
            <span class="card-label">{{ workspace.workspace }}</span>
            @if (workspace.available && workspace.summary) {
            <span class="card-status available">connected</span>
            } @else {
            <span class="card-status empty">no data</span>
            }
          </div>
        </div>

        <div class="card-body">
          @if (workspace.available && workspace.summary) {
          <strong class="headline">{{ workspace.summary.headline }}</strong>
          <div class="balance-display">
            <span class="balance-label">Total balance</span>
            <span class="balance-value">{{
              formatBalance(workspace.summary.metrics?.totalBalance)
            }}</span>
          </div>
          } @else {
          <div class="empty-state">
            <p class="empty-message">No accounts configured</p>
            <a
              class="cta-link"
              [routerLink]="['/finance', workspace.workspace, 'accounts']"
            >
              Connect accounts
            </a>
          </div>
          }
        </div>

        <div class="card-footer">
          <a
            class="action-link"
            [routerLink]="['/finance', workspace.workspace]"
          >
            Open workspace
            <span class="action-arrow">→</span>
          </a>
        </div>
      </article>
      }

      <!-- ── EMPTY PROMPTS ──────────────────────────────────── -->
      @if (activeOverview.goals.length === 0) {
      <article class="empty-prompt-card" style="animation-delay: 0.28s">
        <div class="prompt-icon-wrap">
          <span class="prompt-icon">◎</span>
        </div>
        <h3>No goals yet</h3>
        <p>Create financial targets to track your progress.</p>
        <a
          class="cta-button"
          [routerLink]="['/commander', activeOverview.plan.id, 'goals']"
        >
          Create first goal
        </a>
      </article>
      } @if (activeOverview.scenarios.length === 0) {
      <article class="empty-prompt-card" style="animation-delay: 0.35s">
        <div class="prompt-icon-wrap">
          <span class="prompt-icon">◈</span>
        </div>
        <h3>No scenarios modeled</h3>
        <p>Plan for the future by modeling different outcomes.</p>
        <a
          class="cta-button"
          [routerLink]="['/commander', activeOverview.plan.id, 'scenarios']"
        >
          Create first scenario
        </a>
      </article>
      }
    </section>
    } @else {

    <!-- ── EMPTY STATE ─────────────────────────────────────── -->
    <section class="overview-empty">
      <div class="empty-glyph">◉</div>
      <h2>No plan yet</h2>
      <p>
        Create your first plan to track goals, compare scenarios, and keep each
        workspace aligned.
      </p>
      <a class="empty-button" routerLink="/commander/new/overview">
        Create your first plan →
      </a>
    </section>
    }
  `,
  styles: [
    `
      /* ─── GRID ───────────────────────────────────────────────── */
      .overview-grid {
        display: grid;
        gap: 1.25rem;
        grid-template-columns: repeat(3, 1fr);
      }

      /* ─── SHARED CARD ENTRANCE ───────────────────────────────── */
      .workspace-card,
      .empty-prompt-card {
        animation: cardReveal 0.55s
          var(--fc-transition-easing, cubic-bezier(0.16, 1, 0.3, 1)) both;
      }

      @keyframes cardReveal {
        from {
          opacity: 0;
          transform: translateY(16px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* ─── SPOTLIGHT ──────────────────────────────────────────── */
      .spotlight-card {
        grid-column: 1 / -1;
        position: relative;
        overflow: hidden;
        border-radius: var(--fc-card-radius, 18px);
        border: var(--fc-border-width, 2px) solid
          color-mix(in srgb, var(--primary) 30%, transparent);
        box-shadow: var(--fc-card-shadow, 0 20px 40px rgba(4, 16, 28, 0.24));
        background: linear-gradient(
          125deg,
          color-mix(in srgb, var(--primary) 6%, var(--surface)) 0%,
          color-mix(
              in srgb,
              var(--secondary, var(--primary)) 4%,
              var(--surface)
            )
            100%
        );
        animation: cardReveal 0.5s 0.05s
          var(--fc-transition-easing, cubic-bezier(0.16, 1, 0.3, 1)) both;
      }

      .spotlight-bg {
        position: absolute;
        inset: 0;
        pointer-events: none;
        opacity: 0.35;
      }

      .spotlight-inner {
        position: relative;
        z-index: 1;
        padding: clamp(1.1rem, 2vw, 1.5rem);
        display: grid;
        gap: 1rem;
      }

      .spotlight-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        padding: 0.35rem 1rem;
        background: var(--primary);
        color: var(--background);
        font-size: 0.66rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        border-radius: var(--fc-button-radius, 9999px);
      }

      .live-indicator {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--success, #22c55e);
      }

      .live-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--success, #22c55e);
        animation: livePulse 2.5s ease-in-out infinite;
      }

      @keyframes livePulse {
        0%,
        100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.6;
          transform: scale(0.85);
        }
      }

      .spotlight-metrics {
        display: flex;
        align-items: center;
        gap: 2rem;
        flex-wrap: wrap;
      }

      .metric-block {
        display: grid;
        gap: 0.2rem;
      }

      .metric-number {
        font-family: var(--fc-font-heading, 'Sora', sans-serif);
        font-size: clamp(1.5rem, 3vw, 2.2rem);
        font-weight: 700;
        line-height: 1;
        color: var(--primary);
        font-variant-numeric: tabular-nums;
      }

      .metric-label {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-weight: 600;
        color: var(--muted);
      }

      .metric-divider {
        width: 1px;
        height: 3rem;
        background: color-mix(in srgb, var(--border) 40%, transparent);
        flex-shrink: 0;
      }

      .spotlight-desc {
        margin: 0;
        font-size: 0.92rem;
        line-height: 1.7;
        color: var(--muted);
        max-width: 60ch;
      }

      /* ─── WORKSPACE CARD ─────────────────────────────────────── */
      .workspace-card {
        display: grid;
        grid-template-rows: auto 1fr auto;
        background: color-mix(in srgb, var(--surface) 90%, transparent);
        backdrop-filter: blur(14px);
        border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
        border-radius: var(--fc-card-radius, 18px);
        overflow: hidden;
        transition: var(
          --fc-transition,
          all 0.22s cubic-bezier(0.16, 1, 0.3, 1)
        );

        &:hover {
          transform: translateY(-5px);
          box-shadow: var(
            --fc-card-shadow-hover,
            0 28px 56px rgba(4, 16, 28, 0.32)
          );
          border-color: color-mix(in srgb, var(--primary) 45%, transparent);
        }

        &[data-workspace='personal'] {
          .workspace-icon-wrap {
            background: color-mix(in srgb, var(--primary) 12%, transparent);
          }
          .workspace-icon {
            color: var(--primary);
          }
        }

        &[data-workspace='business'] {
          .workspace-icon-wrap {
            background: color-mix(
              in srgb,
              var(--secondary, var(--primary)) 12%,
              transparent
            );
          }
          .workspace-icon {
            color: var(--secondary, var(--primary));
          }
        }

        &[data-workspace='net-worth'] {
          .workspace-icon-wrap {
            background: color-mix(
              in srgb,
              var(--success, #22c55e) 12%,
              transparent
            );
          }
          .workspace-icon {
            color: var(--success, #22c55e);
          }
        }

        &.empty {
          opacity: 0.72;
        }
      }

      .card-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem 1.25rem;
        border-bottom: 1px solid
          color-mix(in srgb, var(--border) 35%, transparent);
        background: color-mix(in srgb, var(--primary) 3%, transparent);
      }

      .workspace-icon-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2.4rem;
        height: 2.4rem;
        border-radius: 10px;
        flex-shrink: 0;
        font-size: 1.15rem;
        background: color-mix(in srgb, var(--primary) 10%, transparent);
      }

      .workspace-icon {
        font-size: 1.1rem;
        line-height: 1;
      }

      .card-header-text {
        display: grid;
        gap: 0.1rem;
      }

      .card-label {
        text-transform: capitalize;
        font-size: 0.82rem;
        font-weight: 700;
        color: var(--foreground);
        letter-spacing: 0.02em;
      }

      .card-status {
        font-size: 0.62rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-weight: 600;

        &.available {
          color: var(--success, #22c55e);
        }
        &.empty {
          color: var(--muted);
        }
      }

      .card-body {
        padding: 1.25rem;
        display: grid;
        gap: 0.75rem;
        align-content: start;
      }

      .headline {
        font-family: var(--fc-font-heading, 'Sora', sans-serif);
        font-size: 0.95rem;
        font-weight: 600;
        line-height: 1.4;
        color: var(--foreground);
      }

      .balance-display {
        display: grid;
        gap: 0.15rem;
      }

      .balance-label {
        font-size: 0.66rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        font-weight: 600;
        color: var(--muted);
      }

      .balance-value {
        font-family: var(--fc-font-heading, 'Sora', sans-serif);
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--foreground);
        font-variant-numeric: tabular-nums;
      }

      .card-footer {
        padding: 0.85rem 1.25rem;
        border-top: 1px solid color-mix(in srgb, var(--border) 25%, transparent);
      }

      .action-link {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.5rem 1rem;
        background: color-mix(in srgb, var(--primary) 10%, transparent);
        color: var(--primary);
        font-size: 0.78rem;
        font-weight: 700;
        text-decoration: none;
        border-radius: var(--fc-button-radius, 9999px);
        transition: var(
          --fc-transition,
          all 0.22s cubic-bezier(0.16, 1, 0.3, 1)
        );

        &:hover {
          background: var(--primary);
          color: var(--background);
        }
      }

      .action-arrow {
        transition: transform 0.2s ease;
      }

      .action-link:hover .action-arrow {
        transform: translateX(3px);
      }

      .empty-state {
        display: grid;
        gap: 0.75rem;
        justify-items: start;
      }

      .empty-message {
        margin: 0;
        font-size: 0.88rem;
        color: var(--muted);
      }

      .cta-link {
        display: inline-flex;
        align-items: center;
        padding: 0.5rem 1rem;
        background: var(--primary);
        color: var(--background);
        font-size: 0.78rem;
        font-weight: 600;
        text-decoration: none;
        border-radius: 999px;
        transition: var(
          --fc-transition,
          all 0.22s cubic-bezier(0.16, 1, 0.3, 1)
        );

        &:hover {
          opacity: 0.88;
        }
      }

      /* ─── EMPTY PROMPT CARD ──────────────────────────────────── */
      .empty-prompt-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 0.75rem;
        padding: 2.25rem 1.5rem;
        background: color-mix(in srgb, var(--surface) 85%, transparent);
        border: 1px dashed color-mix(in srgb, var(--border) 55%, transparent);
        border-radius: var(--fc-card-radius, 18px);

        h3 {
          margin: 0;
          font-family: var(--fc-font-heading, 'Sora', sans-serif);
          font-size: 1rem;
          font-weight: 700;
          color: var(--foreground);
        }

        p {
          margin: 0;
          font-size: 0.88rem;
          color: var(--muted);
          max-width: 28ch;
          line-height: 1.55;
        }
      }

      .prompt-icon-wrap {
        width: 3rem;
        height: 3rem;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: color-mix(in srgb, var(--primary) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--primary) 20%, transparent);
      }

      .prompt-icon {
        font-size: 1.3rem;
        color: var(--primary);
      }

      .cta-button {
        display: inline-flex;
        align-items: center;
        padding: 0.6rem 1.25rem;
        background: var(--primary);
        color: var(--background);
        font-size: 0.82rem;
        font-weight: 600;
        text-decoration: none;
        border-radius: 999px;
        transition: var(
          --fc-transition,
          all 0.22s cubic-bezier(0.16, 1, 0.3, 1)
        );

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 18px
            color-mix(in srgb, var(--primary) 35%, transparent);
        }
      }

      /* ─── OVERVIEW EMPTY ─────────────────────────────────────── */
      .overview-empty {
        display: grid;
        place-items: center;
        gap: 0.85rem;
        min-height: 320px;
        text-align: center;
        padding: 2.5rem 2rem;
        background: color-mix(in srgb, var(--surface) 90%, transparent);
        border: 1px dashed color-mix(in srgb, var(--border) 55%, transparent);
        border-radius: var(--fc-card-radius, 18px);
        animation: cardReveal 0.5s 0.1s cubic-bezier(0.16, 1, 0.3, 1) both;

        h2,
        p {
          margin: 0;
        }

        h2 {
          font-family: var(--fc-font-heading, 'Sora', sans-serif);
          font-size: clamp(1.4rem, 3vw, 1.8rem);
          font-weight: 700;
          color: var(--foreground);
        }

        p {
          font-size: 0.92rem;
          color: var(--muted);
          max-width: 44ch;
          line-height: 1.65;
        }
      }

      .empty-glyph {
        font-size: 2.5rem;
        opacity: 0.3;
        color: var(--primary);
        line-height: 1;
      }

      .empty-button {
        display: inline-flex;
        align-items: center;
        padding: 0.75rem 1.5rem;
        border-radius: 999px;
        background: var(--primary);
        color: var(--background);
        font-weight: 700;
        text-decoration: none;
        transition: var(
          --fc-transition,
          all 0.22s cubic-bezier(0.16, 1, 0.3, 1)
        );

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px
            color-mix(in srgb, var(--primary) 40%, transparent);
        }
      }

      /* ─── RESPONSIVE ─────────────────────────────────────────── */
      @media (max-width: 900px) {
        .overview-grid {
          grid-template-columns: repeat(2, 1fr);
        }

        .spotlight-metrics {
          gap: 1.25rem;
        }

        .metric-number {
          font-size: clamp(1.3rem, 3vw, 1.8rem);
        }
      }

      @media (max-width: 580px) {
        .overview-grid {
          grid-template-columns: 1fr;
        }

        .spotlight-metrics {
          gap: 1rem;
        }

        .metric-divider {
          display: none;
        }

        .spotlight-metrics {
          gap: 1.5rem;
        }
      }
    `,
  ],
})
export class OverviewPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(FinCommanderPlanStore);
  private readonly routePlanId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('planId'))),
    { initialValue: this.route.snapshot.paramMap.get('planId') }
  );
  private loadVersion = 0;

  readonly overview = signal<FinCommanderOverview | null>(null);
  readonly plans = signal(this.store.listPlans());

  constructor() {
    effect(() => {
      this.store.getScope();
      this.plans.set(this.store.listPlans());

      const planId = this.routePlanId() ?? this.plans()[0]?.id;
      if (!planId) {
        this.overview.set(null);
        return;
      }

      const loadVersion = ++this.loadVersion;
      void this.loadOverview(planId, loadVersion);
    });
  }

  getWorkspaceIcon(workspace: string): string {
    switch (workspace) {
      case 'personal':
        return '💰';
      case 'business':
        return '📊';
      case 'net-worth':
        return '📈';
      default:
        return '📁';
    }
  }

  formatBalance(balance: number | undefined): string {
    if (balance === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(balance);
  }

  private async loadOverview(
    planId: string,
    loadVersion: number
  ): Promise<void> {
    const overview = await this.store.buildOverview(planId);
    if (loadVersion !== this.loadVersion) {
      return;
    }
    this.overview.set(overview);
  }
}
