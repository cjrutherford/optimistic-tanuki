import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import {
  catchError,
  forkJoin,
  interval,
  of,
  startWith,
  switchMap,
  Subscription,
} from 'rxjs';
import {
  PerformanceAlert,
  PerformanceObservabilityService,
  PerformanceSummary,
  RuntimeSummary,
} from '../services/performance-observability.service';

@Component({
  selector: 'app-performance-observability',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <section class="performance-page">
      <header class="page-header">
        <div>
          <p class="eyebrow">Operations / Performance</p>
          <h1>Application performance</h1>
          <p>
            Aggregated browser and route telemetry across the Angular portfolio.
          </p>
        </div>
        <span class="refresh">Refreshes every 30 seconds</span>
      </header>

      <p class="error" *ngIf="error">{{ error }}</p>

      <section class="metrics" aria-label="Performance overview">
        <article>
          <span>Apps reporting</span><strong>{{ appCount }}</strong>
        </article>
        <article>
          <span>Routes reporting</span><strong>{{ routeCount }}</strong>
        </article>
        <article>
          <span>Active alerts</span><strong>{{ activeAlertCount }}</strong>
        </article>
        <article>
          <span>Critical alerts</span><strong>{{ criticalAlertCount }}</strong>
        </article>
      </section>

      <section class="panel">
        <h2>Route measurements</h2>
        <p class="muted">
          Percentiles are calculated from aggregated samples; no user
          identifiers are retained.
        </p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>App</th>
                <th>Route</th>
                <th>Mode</th>
                <th>Metric</th>
                <th>p75</th>
                <th>p95</th>
                <th>Samples</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of rows">
                <td>{{ row.summary.appId }}</td>
                <td>{{ row.summary.route }}</td>
                <td>{{ row.summary.renderMode }}</td>
                <td>{{ row.metric }}</td>
                <td>{{ format(row.measurement.p75, row.metric) }}</td>
                <td>{{ format(row.measurement.p95, row.metric) }}</td>
                <td>{{ row.measurement.samples }}</td>
              </tr>
              <tr *ngIf="!rows.length">
                <td colspan="7" class="empty">
                  No performance samples have arrived yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <h2>Runtime resources</h2>
        <p class="muted">
          Latest OTEL process observations from each SSR application.
        </p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>App</th>
                <th>CPU</th>
                <th>RSS memory</th>
                <th>GC pause</th>
                <th>GC events</th>
                <th>Observed</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let runtime of runtimeSnapshots">
                <td>{{ runtime.appId }}</td>
                <td>{{ formatRuntime(runtime.cpuUtilization, 'cpu') }}</td>
                <td>{{ formatRuntime(runtime.memoryRssBytes, 'bytes') }}</td>
                <td>{{ formatRuntime(runtime.gcPauseMs, 'ms') }}</td>
                <td>{{ runtime.gcPauseCount ?? '—' }}</td>
                <td>{{ runtime.observedAt | date : 'medium' }}</td>
              </tr>
              <tr *ngIf="!runtimeSnapshots.length">
                <td colspan="6" class="empty">
                  No OTEL runtime observations have arrived yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>Alerts</h2>
            <p class="muted">
              SLO breaches require sustained bad windows before notification.
            </p>
          </div>
        </div>
        <div class="alert-list">
          <article
            *ngFor="let alert of alerts"
            class="alert"
            [class.critical]="alert.severity === 'critical'"
          >
            <div>
              <strong
                >{{ alert.severity | uppercase }} · {{ alert.appId }}</strong
              >
              <p>
                {{ alert.metric | uppercase }} on {{ alert.route }}:
                {{ format(alert.observed, alert.metric) }} (threshold
                {{ format(alert.threshold, alert.metric) }})
              </p>
            </div>
            <div class="alert-actions">
              <span>{{ alert.state }}</span
              ><button
                *ngIf="alert.state === 'active'"
                (click)="acknowledge(alert)"
              >
                Acknowledge
              </button>
            </div>
            <small>{{ alert.createdAt | date : 'medium' }}</small>
          </article>
          <p *ngIf="!alerts.length" class="empty">No alerts recorded.</p>
        </div>
      </section>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 2rem;
        color: var(--foreground);
      }
      .page-header,
      .panel-heading {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: flex-start;
      }
      .eyebrow,
      .muted,
      .refresh {
        color: var(--muted);
      }
      h1 {
        margin: 0.25rem 0;
      }
      h2 {
        margin: 0 0 0.4rem;
      }
      .metrics {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 1rem;
        margin: 1.5rem 0;
      }
      .metrics article,
      .panel,
      .alert {
        border: 1px solid rgba(148, 163, 184, 0.2);
        background: rgba(15, 23, 42, 0.65);
        border-radius: 0.8rem;
        padding: 1rem;
      }
      .metrics span {
        display: block;
        color: var(--muted);
        font-size: 0.85rem;
      }
      .metrics strong {
        display: block;
        font-size: 1.8rem;
        margin-top: 0.3rem;
      }
      .panel {
        margin-top: 1rem;
        overflow: hidden;
      }
      .table-wrap {
        overflow: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        text-align: left;
        padding: 0.7rem;
        border-bottom: 1px solid rgba(148, 163, 184, 0.13);
        white-space: nowrap;
      }
      th {
        color: var(--muted);
        font-size: 0.8rem;
        text-transform: uppercase;
      }
      .empty {
        color: var(--muted);
        padding: 1rem 0;
      }
      .alert-list {
        display: grid;
        gap: 0.75rem;
        margin-top: 1rem;
      }
      .alert {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.5rem;
      }
      .alert.critical {
        border-color: var(--danger);
      }
      .alert p {
        margin: 0.35rem 0 0;
        color: var(--muted);
      }
      .alert small {
        grid-column: 1/-1;
        color: var(--muted);
      }
      .alert-actions {
        display: flex;
        align-items: flex-start;
        gap: 0.6rem;
        color: var(--warning);
      }
      button {
        border: 1px solid var(--border-color);
        border-radius: 0.4rem;
        background: transparent;
        color: inherit;
        padding: 0.35rem 0.6rem;
        cursor: pointer;
      }
      .error {
        color: var(--danger);
      }
      @media (max-width: 700px) {
        :host {
          padding: 1rem;
        }
        .metrics {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .page-header {
          display: block;
        }
      }
    `,
  ],
})
export class PerformanceObservabilityComponent implements OnInit, OnDestroy {
  private readonly service = inject(PerformanceObservabilityService);
  private subscription?: Subscription;
  summaries: PerformanceSummary[] = [];
  alerts: PerformanceAlert[] = [];
  runtimeSnapshots: RuntimeSummary[] = [];
  error = '';

  ngOnInit(): void {
    this.subscription = interval(30_000)
      .pipe(
        startWith(0),
        switchMap(() =>
          forkJoin({
            summary: this.service.summary(),
            alerts: this.service.alerts(),
            runtime: this.service.runtime(),
          }).pipe(
            catchError(() => {
              this.error = 'Performance telemetry is temporarily unavailable.';
              return of({ summary: [], alerts: [], runtime: [] });
            })
          )
        )
      )
      .subscribe(({ summary, alerts, runtime }) => {
        this.summaries = summary;
        this.alerts = alerts;
        this.runtimeSnapshots = runtime;
        this.error = '';
      });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  acknowledge(alert: PerformanceAlert): void {
    this.service.acknowledge(alert.id).subscribe((updated) => {
      this.alerts = this.alerts.map((item) =>
        item.id === updated.id ? updated : item
      );
    });
  }

  get appCount(): number {
    return new Set(this.summaries.map((summary) => summary.appId)).size;
  }
  get routeCount(): number {
    return new Set(
      this.summaries.map((summary) => `${summary.appId}|${summary.route}`)
    ).size;
  }
  get activeAlertCount(): number {
    return this.alerts.filter((alert) => alert.state === 'active').length;
  }
  get criticalAlertCount(): number {
    return this.alerts.filter(
      (alert) => alert.severity === 'critical' && alert.state === 'active'
    ).length;
  }
  get rows() {
    return this.summaries.flatMap((summary) =>
      Object.entries(summary.metrics).map(([metric, measurement]) => ({
        summary,
        metric,
        measurement,
      }))
    );
  }
  format(value: number, metric: string): string {
    return metric === 'cls' ? value.toFixed(3) : `${Math.round(value)} ms`;
  }
  formatRuntime(
    value: number | undefined,
    unit: 'cpu' | 'bytes' | 'ms'
  ): string {
    if (value === undefined) return '—';
    if (unit === 'cpu') return `${(value * 100).toFixed(1)}%`;
    if (unit === 'bytes') return `${(value / 1024 / 1024).toFixed(1)} MB`;
    return `${value.toFixed(1)} ms`;
  }
}
