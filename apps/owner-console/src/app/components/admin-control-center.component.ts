import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ControlCenterService,
  ControlCenterStatus,
  OAuthInspection,
  RolloutPreview,
  RolloutState,
  RolloutHistoryEntry,
  OAuthProviderDetail,
} from '../services/control-center.service';

@Component({
  selector: 'app-admin-control-center',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="admin-page">
      <header class="hero">
        <p class="eyebrow">Authenticated Control Plane</p>
        <h1>Production rollout and OAuth inspection</h1>
        <p>
          This workspace is the first operational slice of the server admin
          dashboard: tag-driven rollout preview plus effective OAuth provider
          inspection against the checked-in production preset.
        </p>
      </header>

      @if (status(); as summary) {
      <section class="grid">
        <article class="panel">
          <h2>Production preset</h2>
          <dl>
            <div>
              <dt>Deployment</dt>
              <dd>{{ summary.deploymentName }}</dd>
            </div>
            <div>
              <dt>Namespace</dt>
              <dd>{{ summary.namespace }}</dd>
            </div>
            <div>
              <dt>Provider</dt>
              <dd>{{ summary.provider }}</dd>
            </div>
            <div>
              <dt>Default tag</dt>
              <dd>{{ summary.defaultTag }}</dd>
            </div>
          </dl>
        </article>

        <article class="panel">
          <h2>Rollout preview</h2>
          <label for="tag">Target tag</label>
          <div class="rollout-controls">
            <input id="tag" [(ngModel)]="targetTag" />
            <button type="button" (click)="refreshRollout()">Preview</button>
            <button type="button" (click)="startRollout()">Deploy</button>
          </div>
          @if (rollout(); as preview) {
          <p class="strategy">{{ preview.strategy }}</p>
          <p>
            {{ preview.services.length }} services in staged pull/recreate plan.
          </p>
          <div class="waves">
            @for (wave of preview.waves; track $index) {
            <article class="wave">
              <h3>Wave {{ $index + 1 }}</h3>
              <p>{{ wave.join(', ') }}</p>
            </article>
            }
          </div>
          }
        </article>
      </section>
      } @if (latestRollout(); as latest) {
      <section class="panel">
        <h2>Latest rollout</h2>
        <p class="strategy">{{ latest.status }} for {{ latest.targetTag }}</p>
        <p>{{ latest.services.length }} services tracked in this rollout.</p>
        @if (latest.error) {
        <p><strong>Error:</strong> {{ latest.error }}</p>
        }
      </section>
      }

      <section class="panel">
        <h2>Rollout history</h2>
        <div class="history-list">
          @for (entry of rolloutHistory(); track entry.startedAt) {
          <article class="history-entry">
            <span
              class="history-status"
              [class.succeeded]="entry.status === 'succeeded'"
              [class.failed]="entry.status === 'failed'"
              [class.running]="entry.status === 'running'"
            >
              {{ entry.status }}
            </span>
            <span class="history-tag">{{ entry.targetTag }}</span>
            <span class="history-services"
              >{{ entry.services.length }} services</span
            >
            <span class="history-time">{{ entry.startedAt }}</span>
          </article>
          }
        </div>
      </section>

      <section class="panel">
        <h2>OAuth providers</h2>
        <div class="oauth-providers-grid">
          @for (provider of oauthProviders(); track provider.name) {
          <article class="provider-card">
            <div class="provider-header">
              <h3>{{ provider.name }}</h3>
              <span
                class="provider-status"
                [class.configured]="provider.status === 'configured'"
                [class.pending]="provider.status === 'pending'"
                [class.error]="provider.status === 'error'"
              >
                {{ provider.status }}
              </span>
            </div>
            <p>
              <strong>Client ID:</strong>
              {{ provider.clientIdPresent ? 'Present' : 'Missing' }}
            </p>
            <p>
              <strong>Client Secret:</strong>
              {{ provider.clientSecretPresent ? 'Present' : 'Missing' }}
            </p>
            <p>
              <strong>Redirect URI:</strong>
              {{ provider.redirectUri || 'Not set' }}
            </p>
            @if (provider.validationErrors.length > 0) {
            <ul class="validation-errors">
              @for (err of provider.validationErrors; track err) {
              <li>{{ err }}</li>
              }
            </ul>
            }
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

      .admin-page {
        display: grid;
        gap: 24px;
      }

      .hero,
      .panel {
        border: 1px solid rgba(18, 51, 47, 0.12);
        border-radius: 24px;
        padding: 24px;
        background: rgba(255, 255, 255, 0.92);
      }

      .eyebrow {
        margin: 0 0 10px;
        font-size: 0.8rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #0f766e;
        font-weight: 700;
      }

      h1,
      h2,
      h3,
      p {
        margin: 0;
      }

      .hero p,
      .panel p {
        margin-top: 12px;
        line-height: 1.6;
      }

      .grid,
      .providers,
      .waves {
        display: grid;
        gap: 16px;
      }

      .grid {
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      }

      dl {
        display: grid;
        gap: 12px;
        margin: 16px 0 0;
      }

      dl div {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        border-top: 1px solid rgba(18, 51, 47, 0.08);
        padding-top: 12px;
      }

      .rollout-controls {
        display: flex;
        gap: 12px;
        margin-top: 12px;
      }

      input {
        flex: 1;
        min-width: 0;
        border-radius: 12px;
        border: 1px solid rgba(18, 51, 47, 0.18);
        padding: 12px 14px;
      }

      button {
        border: none;
        border-radius: 12px;
        padding: 12px 16px;
        background: #0f766e;
        color: white;
        font-weight: 700;
      }

      .strategy {
        font-weight: 700;
        color: #0f766e;
      }

      .wave,
      .provider-card {
        border: 1px solid rgba(18, 51, 47, 0.1);
        border-radius: 18px;
        padding: 16px;
        background: rgba(245, 250, 250, 0.9);
      }

      .provider-header {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: baseline;
      }

      .provider-header span {
        font-size: 0.85rem;
        font-weight: 700;
        color: #0d6b2b;
      }

      .provider-header span.disabled {
        color: #8d4b00;
      }

      .history-list {
        display: grid;
        gap: 12px;
        margin-top: 12px;
      }

      .history-entry {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border: 1px solid rgba(18, 51, 47, 0.1);
        border-radius: 12px;
        background: rgba(245, 250, 250, 0.9);
      }

      .history-status {
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
        padding: 2px 8px;
        border-radius: 999px;
      }

      .history-status.succeeded {
        background: rgba(19, 125, 54, 0.14);
        color: #0d6b2b;
      }

      .history-status.failed {
        background: rgba(155, 33, 33, 0.14);
        color: #8b0000;
      }

      .history-status.running {
        background: rgba(196, 112, 0, 0.16);
        color: #8d4b00;
      }

      .history-tag {
        font-family: monospace;
        font-size: 0.85rem;
      }

      .history-services {
        color: #666;
        font-size: 0.85rem;
      }

      .history-time {
        margin-left: auto;
        color: #888;
        font-size: 0.82rem;
      }

      .oauth-providers-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
        margin-top: 12px;
      }

      .provider-status {
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
        padding: 2px 8px;
        border-radius: 999px;
      }

      .provider-status.configured {
        background: rgba(19, 125, 54, 0.14);
        color: #0d6b2b;
      }

      .provider-status.pending {
        background: rgba(196, 112, 0, 0.16);
        color: #8d4b00;
      }

      .provider-status.error {
        background: rgba(155, 33, 33, 0.14);
        color: #8b0000;
      }

      .validation-errors {
        margin: 8px 0 0;
        padding-left: 20px;
        color: #8b0000;
        font-size: 0.85rem;
      }
    `,
  ],
})
export class AdminControlCenterComponent implements OnInit {
  private readonly controlCenter = inject(ControlCenterService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly status = signal<ControlCenterStatus | null>(null);
  readonly rollout = signal<RolloutPreview | null>(null);
  readonly latestRollout = signal<RolloutState | null>(null);
  readonly oauth = signal<OAuthInspection | null>(null);
  readonly rolloutHistory = signal<RolloutHistoryEntry[]>([]);
  readonly oauthProviders = signal<OAuthProviderDetail[]>([]);
  targetTag = 'latest';

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.controlCenter.getPublicStatus().subscribe((status) => {
      this.status.set(status);
      this.targetTag = status.defaultTag;
      this.refreshRollout();
    });
    this.controlCenter.getOAuthInspection().subscribe((oauth) => {
      this.oauth.set(oauth);
    });
    this.controlCenter.getLatestRollout().subscribe({
      next: (state) => this.latestRollout.set(state),
      error: () => this.latestRollout.set(null),
    });
    this.controlCenter.getRolloutHistory(10).subscribe((history) => {
      this.rolloutHistory.set(history);
    });
    this.controlCenter.getOAuthProviders().subscribe((data) => {
      this.oauthProviders.set(data.providers);
    });
  }

  refreshRollout(): void {
    this.controlCenter
      .getRolloutPreview(this.targetTag)
      .subscribe((preview) => {
        this.rollout.set(preview);
      });
  }

  startRollout(): void {
    this.controlCenter.startRollout(this.targetTag).subscribe((state) => {
      this.latestRollout.set(state);
    });
  }
}
