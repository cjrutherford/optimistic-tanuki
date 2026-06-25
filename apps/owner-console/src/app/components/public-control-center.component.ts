import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
  ControlCenterService,
  ControlCenterStatus,
} from '../services/control-center.service';

@Component({
  selector: 'app-public-control-center',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <section class="control-center">
      <header class="hero">
        <p class="eyebrow">Internal Status Surface</p>
        <h1>Platform control center</h1>
        <p>
          This login-free view is intended for internal network access. It
          exposes current deployment posture, host coverage, and control-plane
          availability without exposing write actions.
        </p>
      </header>

      @if (status(); as summary) {
      <section class="metrics">
        <article class="metric-card">
          <span class="metric-label">Deployment</span>
          <strong>{{ summary.deploymentName }}</strong>
          <p>{{ summary.provider }} in {{ summary.namespace }}</p>
        </article>
        <article class="metric-card">
          <span class="metric-label">Default tag</span>
          <strong>{{ summary.defaultTag }}</strong>
          <p>{{ summary.serviceCount }} services in scope</p>
        </article>
        <article class="metric-card">
          <span class="metric-label">OAuth</span>
          <strong>{{ summary.oauthEnabled ? 'Enabled' : 'Disabled' }}</strong>
          <p>{{ summary.oauthProviders }} providers configured</p>
        </article>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <h2>Public host inventory</h2>
          <p>These hosts are part of the checked-in production preset.</p>
        </div>
        <div class="host-grid">
          @for (host of summary.publicHosts; track host) {
          <span class="host-pill">{{ host }}</span>
          }
        </div>
      </section>
      } @else {
      <section class="panel">
        <p>Loading control-center status…</p>
      </section>
      }

      <section class="panel">
        <div class="panel-heading">
          <h2>Operator workflows</h2>
          <p>
            Authenticated operators can review rollout previews, inspect OAuth
            provider state, and manage platform configuration from the dashboard
            shell.
          </p>
        </div>
        <a class="cta" routerLink="/login">Open operator login</a>
      </section>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background: radial-gradient(
            circle at top left,
            rgba(45, 212, 191, 0.16),
            transparent 28%
          ),
          linear-gradient(180deg, #f7fbfb, #eef5f4);
        color: #12332f;
      }

      .control-center {
        display: grid;
        gap: 24px;
        padding: 32px 24px 48px;
        max-width: 1100px;
        margin: 0 auto;
      }

      .hero,
      .panel,
      .metric-card {
        border: 1px solid rgba(18, 51, 47, 0.12);
        border-radius: 24px;
        background: rgba(255, 255, 255, 0.88);
        box-shadow: 0 18px 40px rgba(18, 51, 47, 0.08);
      }

      .hero,
      .panel {
        padding: 24px;
      }

      .eyebrow,
      .metric-label {
        margin: 0 0 10px;
        font-size: 0.8rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #0f766e;
        font-weight: 700;
      }

      h1,
      h2,
      p {
        margin: 0;
      }

      .hero p,
      .panel-heading p,
      .metric-card p {
        margin-top: 12px;
        line-height: 1.6;
      }

      .metrics {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
      }

      .metric-card {
        padding: 20px;
        display: grid;
        gap: 8px;
      }

      .metric-card strong {
        font-size: 1.5rem;
      }

      .panel {
        display: grid;
        gap: 16px;
      }

      .host-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .host-pill {
        padding: 10px 14px;
        border-radius: 999px;
        background: rgba(15, 118, 110, 0.1);
        font-weight: 600;
      }

      .cta {
        width: fit-content;
        padding: 12px 18px;
        border-radius: 999px;
        background: #0f766e;
        color: white;
        text-decoration: none;
        font-weight: 700;
      }
    `,
  ],
})
export class PublicControlCenterComponent implements OnInit {
  private readonly controlCenter = inject(ControlCenterService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly status = signal<ControlCenterStatus | null>(null);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.controlCenter.getPublicStatus().subscribe((status) => {
      this.status.set(status);
    });
  }
}
