import { Component, computed, input, output } from '@angular/core';
import type {
  LoadState,
  OwnerServiceHealth,
} from '../services/attention.service';

const WORD: Record<OwnerServiceHealth['status'], string> = {
  up: 'Up',
  degraded: 'Degraded',
  down: 'Down',
};
const MARK: Record<OwnerServiceHealth['status'], string> = {
  up: '✓',
  degraded: '~',
  down: '✕',
};

/**
 * A compact strip of service health. Status is always written out and marked
 * with a symbol; colour only reinforces it.
 */
@Component({
  selector: 'app-health-strip',
  standalone: true,
  template: `
    <section class="health" aria-labelledby="health-heading">
      <div class="health-heading">
        <h2 id="health-heading">Service health</h2>
        @if (health()) {
        <span class="summary" role="status">{{ summary() }}</span>
        }
        <button type="button" class="retry" (click)="retry.emit()">
          Refresh
        </button>
      </div>
      @if (state() === 'error') {
      <p class="bad" role="alert">
        Unavailable. Service health could not be checked.
        <button type="button" class="retry" (click)="retry.emit()">
          Retry
        </button>
      </p>
      } @else if (!health()) {
      <p class="muted">Checking…</p>
      } @else {
      <ul class="chips">
        @for (service of ordered(); track service.name) {
        <li
          class="chip"
          [class.chip--down]="service.status === 'down'"
          [class.chip--degraded]="service.status === 'degraded'"
          [title]="service.detail ?? ''"
        >
          <span aria-hidden="true">{{ mark(service) }}</span>
          <span class="name">{{ service.name }}</span>
          <span class="word">{{ word(service) }}</span>
          @if (service.latencyMs !== null) {
          <span class="ms">{{ service.latencyMs }} ms</span>
          }
        </li>
        }
      </ul>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .health {
        padding: 16px 20px;
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: var(--personality-card-radius, 18px);
        background: var(--surface, #ffffff);
        color: var(--foreground, #111827);
      }

      .health-heading {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 16px;
      }

      h2 {
        margin: 0;
        font-family: var(--font-heading, inherit);
        font-size: var(--type-h4, 1rem);
      }

      .summary {
        flex: 1;
        font-size: var(--type-small, 0.85rem);
      }

      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 12px 0 0;
        padding: 0;
        list-style: none;
      }

      .chip {
        display: inline-flex;
        align-items: baseline;
        gap: 6px;
        padding: 2px 10px;
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 9999px;
        font-size: var(--type-small, 0.85rem);
      }

      .chip--degraded {
        border-color: var(--warning, var(--foreground, #111827));
        border-style: dashed;
      }

      .chip--down {
        border-color: var(--danger, #b91c1c);
        border-width: 2px;
        font-weight: 700;
      }

      .ms,
      .muted {
        color: var(--muted-foreground, var(--foreground, #111827));
      }

      .bad {
        color: var(--danger, #b91c1c);
      }

      .retry {
        cursor: pointer;
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: var(--personality-input-radius, 8px);
        background: transparent;
        color: inherit;
        font: inherit;
        padding: 2px 10px;
      }
    `,
  ],
})
export class HealthStripComponent {
  readonly health = input<OwnerServiceHealth[] | null>(null);
  readonly state = input<LoadState>('idle');
  readonly retry = output<void>();

  /** Trouble first, so it is read before the long list of healthy services. */
  readonly ordered = computed(() => {
    const rank = { down: 0, degraded: 1, up: 2 } as const;
    return [...(this.health() ?? [])].sort(
      (a, b) => rank[a.status] - rank[b.status] || a.name.localeCompare(b.name)
    );
  });

  readonly summary = computed(() => {
    const all = this.health() ?? [];
    const down = all.filter((s) => s.status === 'down').length;
    const degraded = all.filter((s) => s.status === 'degraded').length;
    if (!down && !degraded) return `All ${all.length} services up`;
    return `${down} down, ${degraded} degraded, ${
      all.length - down - degraded
    } up`;
  });

  word(service: OwnerServiceHealth): string {
    return WORD[service.status];
  }

  mark(service: OwnerServiceHealth): string {
    return MARK[service.status];
  }
}
