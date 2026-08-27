import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, interval } from 'rxjs';
import {
  VideoProcessingOverview,
  VideoProcessingService,
} from '../services/video-processing.service';

@Component({
  selector: 'app-video-processing-monitor',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <section class="processing-page">
      <header class="hero">
        <div>
          <p class="hero-kicker">Operations / Video pipeline</p>
          <h1>Processing queue</h1>
          <p>
            Monitor transcoding progress and recover failed video jobs without
            overwhelming the worker queue.
          </p>
        </div>
        <button
          type="button"
          class="refresh-button"
          (click)="loadOverview()"
          [disabled]="loading"
        >
          Refresh
        </button>
      </header>

      <p class="error" *ngIf="error">{{ error }}</p>

      <section class="metrics" *ngIf="overview">
        @for (status of statuses; track status) {
        <article class="metric" [class]="status">
          <span>{{ status | titlecase }}</span>
          <strong>{{ overview.totals[status] }}</strong>
        </article>
        }
      </section>

      <p
        class="queue-health"
        *ngIf="processingActivity as activity"
        [class.attention]="activity.attention"
      >
        {{ activity.message }}
      </p>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>Recent jobs</h2>
            <p *ngIf="lastRefreshed">
              Last refreshed {{ lastRefreshed | date : 'medium' }} · updates
              every 10 seconds
            </p>
          </div>
          <button
            type="button"
            class="retry-all"
            (click)="retryFailed()"
            [disabled]="loading || retryingAll || !overview?.totals?.failed"
          >
            {{ retryingAll ? 'Queueing…' : 'Retry all failed' }}
          </button>
        </div>

        <div class="empty" *ngIf="!loading && overview?.jobs?.length === 0">
          No processing jobs were found.
        </div>
        <div class="table-wrap" *ngIf="overview?.jobs?.length">
          <table>
            <thead>
              <tr>
                <th>Video</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Failure detail</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              @for (job of overview?.jobs; track job.id) {
              <tr>
                <td>{{ job.title }}</td>
                <td>
                  <span class="status-badge" [class]="job.processingStatus">{{
                    job.processingStatus
                  }}</span>
                </td>
                <td>{{ job.updatedAt | date : 'short' }}</td>
                <td class="error-detail">{{ job.processingError || '—' }}</td>
                <td>
                  <button
                    type="button"
                    [attr.data-testid]="'retry-' + job.id"
                    (click)="retry(job.id)"
                    [disabled]="
                      loading ||
                      retryingAll ||
                      retryingId === job.id ||
                      job.processingStatus === 'ready'
                    "
                  >
                    {{ retryingId === job.id ? 'Queueing…' : 'Retry' }}
                  </button>
                </td>
              </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 24px;
        color: var(--foreground, #111827);
      }
      .processing-page {
        display: grid;
        gap: 24px;
      }
      .hero,
      .panel {
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 24px;
        padding: 24px;
        background: linear-gradient(
          145deg,
          color-mix(
            in srgb,
            var(--surface, #fff) 97%,
            var(--accent, #0a6c74) 3%
          ),
          var(--surface, #fff)
        );
      }
      .hero,
      .panel-heading {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        align-items: start;
      }
      .hero-kicker {
        margin: 0 0 8px;
        color: var(--accent, #0a6c74);
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      h1,
      h2,
      p {
        margin: 0;
      }
      .hero p:not(.hero-kicker),
      .panel-heading p {
        margin-top: 8px;
        line-height: 1.5;
        color: var(--muted-foreground, #52606d);
      }
      .metrics {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 12px;
      }
      .metric {
        border-left: 4px solid var(--border-color, #d6d6d6);
        border-radius: 12px;
        padding: 16px;
        background: var(--surface, #fff);
        text-transform: capitalize;
      }
      .metric strong {
        display: block;
        margin-top: 6px;
        font-size: 2rem;
      }
      .metric.processing {
        border-color: var(--accent, #0a6c74);
      }
      .metric.failed {
        border-color: var(--danger, #b42318);
      }
      .metric.ready {
        border-color: var(--success, #18794e);
      }
      button {
        border: 1px solid var(--border-color, #cbd5e1);
        border-radius: 8px;
        padding: 0.5rem 0.75rem;
        background: var(--surface, #fff);
        color: inherit;
        cursor: pointer;
        font-weight: 700;
      }
      button:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }
      .retry-all {
        border-color: var(--danger, #b42318);
        color: var(--danger, #b42318);
      }
      .queue-health {
        margin: 0;
        padding: 12px 16px;
        border-radius: 12px;
        background: color-mix(in srgb, var(--accent, #0a6c74) 8%, transparent);
        color: var(--muted-foreground, #52606d);
        font-weight: 650;
      }
      .queue-health.attention {
        color: var(--danger, #b42318);
        background: color-mix(in srgb, var(--danger, #b42318) 10%, transparent);
      }
      .table-wrap {
        overflow-x: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 18px;
        text-align: left;
      }
      th,
      td {
        border-top: 1px solid var(--border-color, #d6d6d6);
        padding: 12px 8px;
        vertical-align: top;
      }
      th {
        color: var(--muted-foreground, #52606d);
        font-size: 0.75rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .status-badge {
        display: inline-block;
        border-radius: 999px;
        padding: 0.2rem 0.55rem;
        text-transform: capitalize;
        font-size: 0.8rem;
        font-weight: 700;
        background: color-mix(in srgb, var(--accent, #0a6c74) 12%, transparent);
      }
      .status-badge.failed {
        color: var(--danger, #b42318);
        background: color-mix(in srgb, var(--danger, #b42318) 12%, transparent);
      }
      .status-badge.ready {
        color: var(--success, #18794e);
        background: color-mix(
          in srgb,
          var(--success, #18794e) 12%,
          transparent
        );
      }
      .error-detail {
        max-width: 26rem;
        color: var(--danger, #b42318);
      }
      .empty,
      .error {
        padding: 16px;
        border-radius: 12px;
        background: color-mix(in srgb, var(--accent, #0a6c74) 8%, transparent);
      }
      .error {
        color: var(--danger, #b42318);
        background: color-mix(in srgb, var(--danger, #b42318) 10%, transparent);
      }
      @media (max-width: 700px) {
        :host {
          padding: 16px;
        }
        .hero,
        .panel-heading {
          flex-direction: column;
        }
      }
    `,
  ],
})
export class VideoProcessingMonitorComponent implements OnInit {
  private readonly processingService = inject(VideoProcessingService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  readonly statuses = ['pending', 'processing', 'ready', 'failed'] as const;
  overview: VideoProcessingOverview | null = null;
  loading = false;
  retryingId: string | null = null;
  retryingAll = false;
  error = '';
  lastRefreshed: Date | null = null;

  ngOnInit(): void {
    this.loadOverview();
    if (isPlatformBrowser(this.platformId)) {
      interval(10_000)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.loadOverview());
    }
  }

  get processingActivity(): { message: string; attention: boolean } | null {
    const queue = this.overview?.queue;
    if (!queue || !this.overview) return null;
    if (queue.activeJobs > 0) {
      return {
        message: `Transcoding ${queue.activeJobs} job(s) · ${queue.queuedJobs} queued`,
        attention: false,
      };
    }
    if (this.overview.totals.processing > 0) {
      return {
        message: `Attention: ${this.overview.totals.processing} processing job(s) have no active transcoder job.`,
        attention: true,
      };
    }
    return { message: 'Transcoder is idle.', attention: false };
  }

  loadOverview(): void {
    if (this.loading) return;
    this.loading = true;
    this.error = '';
    this.processingService
      .getOverview()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (overview) => {
          this.overview = overview;
          this.lastRefreshed = new Date();
        },
        error: () => {
          this.error =
            'The processing overview could not be loaded. Try refreshing the queue.';
        },
      });
  }

  retry(id: string): void {
    if (this.loading || this.retryingAll || this.retryingId) return;
    this.retryingId = id;
    this.processingService
      .retry(id)
      .pipe(finalize(() => (this.retryingId = null)))
      .subscribe({
        next: () => this.loadOverview(),
        error: () => (this.error = 'This video could not be queued for retry.'),
      });
  }

  retryFailed(): void {
    if (
      this.loading ||
      this.retryingAll ||
      !this.overview?.totals.failed ||
      !confirm(
        `Queue ${this.overview.totals.failed} failed video job(s) for retry?`
      )
    )
      return;
    this.retryingAll = true;
    this.processingService
      .retryFailed()
      .pipe(finalize(() => (this.retryingAll = false)))
      .subscribe({
        next: () => this.loadOverview(),
        error: () =>
          (this.error = 'Failed jobs could not be queued for retry.'),
      });
  }
}
