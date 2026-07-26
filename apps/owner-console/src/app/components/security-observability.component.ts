import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  AfterViewChecked,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, interval, of, startWith, switchMap } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import {
  SecurityEvent,
  SecurityObservabilityService,
  SecurityMetrics,
} from '../services/security-observability.service';

Chart.register(...registerables);

@Component({
  selector: 'app-security-observability',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <section class="security-page">
      <header>
        <p>Operations / Security</p>
        <h1>Public edge activity</h1>
        <span>Updates every 5 seconds · raw events retained for 7 days</span>
      </header>

      <p class="error" *ngIf="error">{{ error }}</p>

      <section class="metrics" *ngIf="!loading">
        <article>
          <span>Unsupported URLs</span><strong>{{ unsupportedUrls }}</strong>
        </article>
        <article>
          <span>Denied requests</span><strong>{{ deniedRequests }}</strong>
        </article>
        <article>
          <span>Blocked requests</span><strong>{{ blockedRequests }}</strong>
        </article>
        <article>
          <span>Requests (60m)</span
          ><strong>{{ metrics?.totals?.requests ?? 0 }}</strong>
        </article>
        <article>
          <span>Server errors (60m)</span
          ><strong>{{ metrics?.totals?.serverErrors ?? 0 }}</strong>
        </article>
      </section>

      <label class="range-control" *ngIf="!loading"
        >Time range
        <select
          [value]="rangeMinutes"
          (change)="setRange($any($event.target).value)"
        >
          <option value="15">Last 15 minutes</option>
          <option value="60">Last hour</option>
          <option value="360">Last 6 hours</option>
        </select>
      </label>

      <section class="panel chart-panel" *ngIf="metrics">
        <div>
          <h2>Request activity</h2>
          <p>Last 60 minutes · requests, denied traffic, and server errors</p>
        </div>
        <div class="chart-wrap">
          <canvas
            #activityChart
            aria-label="Security request activity chart"
            role="img"
          ></canvas>
        </div>
      </section>

      <section class="rankings" *ngIf="metrics">
        <article>
          <h2>Top paths</h2>
          <p *ngFor="let path of metrics.topPaths">
            <code>{{ path.path }}</code> <strong>{{ path.count }}</strong>
          </p>
        </article>
        <article>
          <h2>Active hosts</h2>
          <p *ngFor="let host of metrics.topHosts">
            <code>{{ host.host }}</code> <strong>{{ host.count }}</strong>
          </p>
        </article>
      </section>

      <section class="panel">
        <div>
          <h2>Recent security events</h2>
          <p>
            Client addresses are masked unless an enforcement operator
            investigates a decision.
          </p>
        </div>
        <p *ngIf="!loading && events.length === 0">No recent edge events.</p>
        <div class="table-wrap" *ngIf="events.length">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Host</th>
                <th>Request</th>
                <th>Status</th>
                <th>Class</th>
                <th>Client</th>
              </tr>
            </thead>
            <tbody>
              @for (event of events; track event.timestamp + event.path +
              event.clientAddress) {
              <tr>
                <td>{{ event.timestamp | date : 'shortTime' }}</td>
                <td>{{ event.host }}</td>
                <td>
                  <code>{{ event.method }} {{ event.path }}</code>
                </td>
                <td>{{ event.status }}</td>
                <td>{{ event.classification }}</td>
                <td>{{ event.clientAddress || '—' }}</td>
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
        color: var(--foreground);
      }
      .security-page {
        display: grid;
        gap: 24px;
      }
      header,
      .panel,
      article {
        border: 1px solid var(--border-color);
        border-radius: 20px;
        background: var(--surface);
        padding: 24px;
      }
      header p {
        color: var(--accent);
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        margin: 0 0 8px;
        font-size: 0.78rem;
      }
      h1,
      h2 {
        margin: 0;
      }
      header span,
      .panel p {
        color: var(--muted);
        display: block;
        margin-top: 8px;
      }
      .metrics {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 16px;
      }
      article span {
        color: var(--muted);
      }
      article strong {
        display: block;
        font-size: 2.2rem;
        margin-top: 8px;
      }
      .table-wrap {
        overflow: auto;
        margin-top: 16px;
      }
      .chart-wrap {
        height: 280px;
        margin-top: 16px;
        position: relative;
      }
      .range-control {
        display: flex;
        gap: 10px;
        align-items: center;
        font-weight: 700;
      }
      select {
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 8px;
        background: var(--surface);
      }
      .rankings {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 16px;
      }
      .rankings article p {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
      }
      th,
      td {
        border-top: 1px solid var(--border-color);
        padding: 10px 8px;
        white-space: nowrap;
      }
      th {
        font-size: 0.74rem;
        text-transform: uppercase;
        color: var(--muted);
      }
      code {
        font-size: 0.82rem;
      }
      .error {
        color: var(--danger);
      }
    `,
  ],
})
export class SecurityObservabilityComponent
  implements OnInit, AfterViewChecked
{
  private readonly telemetry = inject(SecurityObservabilityService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  events: SecurityEvent[] = [];
  metrics: SecurityMetrics | null = null;
  loading = true;
  error = '';
  rangeMinutes = 60;
  @ViewChild('activityChart') activityChartRef?: ElementRef<HTMLCanvasElement>;
  private activityChart?: Chart;
  private chartRendered = false;

  get unsupportedUrls() {
    return this.count('unsupported_url');
  }

  get deniedRequests() {
    return this.count('denied') + this.count('rate_limited');
  }

  get blockedRequests() {
    return this.count('blocked');
  }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    interval(5000)
      .pipe(
        startWith(0),
        switchMap(() => this.load()),
        catchError(() => {
          this.error = 'Security telemetry is temporarily unavailable.';
          return of({ events: { events: [] }, metrics: null });
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ events: { events }, metrics }) => {
        this.events = events;
        this.metrics = metrics;
        this.chartRendered = false;
        this.loading = false;
      });
  }

  ngAfterViewChecked(): void {
    if (
      !this.chartRendered &&
      this.metrics &&
      isPlatformBrowser(this.platformId)
    )
      this.renderActivityChart();
  }

  private load() {
    const to = new Date();
    const from = new Date(to.valueOf() - this.rangeMinutes * 60 * 1000);
    return forkJoin({
      events: this.telemetry.events({ from: from.toISOString(), limit: 100 }),
      metrics: this.telemetry.metrics({
        from: from.toISOString(),
        to: to.toISOString(),
        bucket: this.rangeMinutes <= 60 ? '5m' : '15m',
      }),
    });
  }

  setRange(value: string): void {
    this.rangeMinutes = Number(value);
    this.load()
      .pipe(catchError(() => of({ events: { events: [] }, metrics: null })))
      .subscribe(({ events: { events }, metrics }) => {
        this.events = events;
        this.metrics = metrics;
        this.chartRendered = false;
      });
  }

  private renderActivityChart(): void {
    const canvas = this.activityChartRef?.nativeElement;
    const context = canvas?.getContext('2d');
    if (!context || !this.metrics) return;
    this.activityChart?.destroy();
    this.activityChart = new Chart(context, {
      type: 'line',
      data: {
        labels: this.metrics.series.map((point) =>
          new Date(point.start).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })
        ),
        datasets: [
          {
            label: 'Requests',
            data: this.metrics.series.map((point) => point.requests),
            borderColor: this.themeColor('--accent'),
            backgroundColor: this.translucentThemeColor('--accent', 0.12),
            fill: true,
            tension: 0.32,
          },
          {
            label: 'Denied',
            data: this.metrics.series.map(
              (point) => point.denied + point.rateLimited
            ),
            borderColor: this.themeColor('--warning'),
            tension: 0.32,
          },
          {
            label: 'Server errors',
            data: this.metrics.series.map((point) => point.serverErrors),
            borderColor: this.themeColor('--danger'),
            tension: 0.32,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { beginAtZero: true } },
      },
    });
    this.chartRendered = true;
  }

  private count(classification: SecurityEvent['classification']): number {
    return this.events.filter(
      (event) => event.classification === classification
    ).length;
  }

  private themeColor(name: string): string {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
  }

  private translucentThemeColor(name: string, opacity: number): string {
    const color = this.themeColor(name);
    const match = color.match(/^#([\da-f]{6})$/i);
    if (!match) return color;

    const channels = [0, 2, 4].map((offset) =>
      Number.parseInt(match[1].slice(offset, offset + 2), 16)
    );
    return `rgba(${channels.join(', ')}, ${opacity})`;
  }
}
