import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, interval, of, startWith, switchMap } from 'rxjs';
import {
  SecurityEvent,
  SecurityObservabilityService,
} from '../services/security-observability.service';

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
        color: var(--foreground, #172033);
      }
      .security-page {
        display: grid;
        gap: 24px;
      }
      header,
      .panel,
      article {
        border: 1px solid var(--border-color, #d6dce5);
        border-radius: 20px;
        background: var(--surface, #fff);
        padding: 24px;
      }
      header p {
        color: var(--accent, #0a6c74);
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
        color: var(--muted-foreground, #52606d);
        display: block;
        margin-top: 8px;
      }
      .metrics {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 16px;
      }
      article span {
        color: var(--muted-foreground, #52606d);
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
      table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
      }
      th,
      td {
        border-top: 1px solid var(--border-color, #d6dce5);
        padding: 10px 8px;
        white-space: nowrap;
      }
      th {
        font-size: 0.74rem;
        text-transform: uppercase;
        color: var(--muted-foreground, #52606d);
      }
      code {
        font-size: 0.82rem;
      }
      .error {
        color: var(--danger, #b42318);
      }
    `,
  ],
})
export class SecurityObservabilityComponent implements OnInit {
  private readonly telemetry = inject(SecurityObservabilityService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  events: SecurityEvent[] = [];
  loading = true;
  error = '';

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
        switchMap(() =>
          this.telemetry.events({
            from: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            limit: 100,
          })
        ),
        catchError(() => {
          this.error = 'Security telemetry is temporarily unavailable.';
          return of({ events: [] });
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ events }) => {
        this.events = events;
        this.loading = false;
      });
  }

  private count(classification: SecurityEvent['classification']): number {
    return this.events.filter(
      (event) => event.classification === classification
    ).length;
  }
}
