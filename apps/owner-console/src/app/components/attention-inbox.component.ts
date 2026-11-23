import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type {
  LoadState,
  OwnerAttentionItem,
  OwnerAttentionReport,
} from '../services/attention.service';

interface InboxGroup {
  source: string;
  title: string;
  items: OwnerAttentionItem[];
}

/** "3 days ago" for the oldest waiting item; empty when unknown. */
export function ageOf(oldest: string | null, now = Date.now()): string {
  if (!oldest) return '';
  const time = new Date(oldest).getTime();
  if (!Number.isFinite(time)) return '';
  const hours = Math.max(0, Math.floor((now - time) / 3_600_000));
  if (hours < 1) return 'under an hour';
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.floor(hours / 24);
  return `${days} days`;
}

/**
 * What needs the owner, grouped by source. A source that could not be read
 * shows "Unavailable" with Retry; it is never shown as zero.
 */
@Component({
  selector: 'app-attention-inbox',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="inbox" aria-labelledby="inbox-heading">
      <div class="inbox-heading">
        <h2 id="inbox-heading">Needs your attention</h2>
        <button
          type="button"
          class="retry"
          [disabled]="state() === 'loading'"
          (click)="retry.emit()"
        >
          Refresh
        </button>
      </div>

      @if (state() === 'error') {
      <p class="inbox-error" role="alert">
        Unavailable. The attention list could not be loaded.
        <button type="button" class="retry" (click)="retry.emit()">
          Retry
        </button>
      </p>
      } @else if (!report()) {
      <p class="muted" aria-live="polite">Loading…</p>
      } @else if (!groups().length) {
      <p class="muted">Nothing is waiting on you right now.</p>
      } @else {
      <ul class="groups">
        @for (group of groups(); track group.source) {
        <li class="group">
          <h3>{{ group.title }}</h3>
          <ul class="rows">
            @for (item of group.items; track item.source + (item.townId ?? ''))
            {
            <li class="row" [class.row--unavailable]="item.status !== 'ok'">
              @if (item.status === 'ok') {
              <a [routerLink]="item.link" class="row-link">
                <span class="where">{{ where(item) }}</span>
                <span class="count"
                  >{{ item.count
                  }}{{ item.capped ? ' or more' : '' }} waiting</span
                >
                @if (age(item)) {
                <span class="age">oldest {{ age(item) }}</span>
                }
              </a>
              } @else {
              <span class="where">{{ where(item) }}</span>
              <span class="count">Unavailable</span>
              @if (item.error) {
              <span class="age">{{ item.error }}</span>
              }
              <button type="button" class="retry" (click)="retry.emit()">
                Retry
              </button>
              }
            </li>
            }
          </ul>
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

      .inbox {
        padding: 20px;
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: var(--personality-card-radius, 18px);
        background: var(--surface, #ffffff);
        color: var(--foreground, #111827);
      }

      .inbox-heading {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
      }

      h2,
      h3 {
        margin: 0;
        font-family: var(--font-heading, inherit);
        line-height: var(--heading-line-height, 1.2);
      }

      h2 {
        font-size: var(--type-h3, 1.25rem);
      }

      h3 {
        font-size: var(--type-h4, 1rem);
      }

      .groups,
      .rows {
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .groups {
        display: grid;
        gap: 16px;
        margin-top: 16px;
      }

      .rows {
        display: grid;
        gap: 4px;
        margin-top: 6px;
      }

      .row,
      .row-link {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 4px 16px;
      }

      .row-link {
        color: inherit;
        text-decoration: none;
      }

      .row-link:hover .where {
        text-decoration: underline;
      }

      .row-link:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: 2px;
      }

      .count {
        font-weight: 700;
      }

      .row--unavailable .count {
        color: var(--danger, #b91c1c);
      }

      .age,
      .muted {
        color: var(--muted-foreground, var(--foreground, #111827));
        font-size: var(--type-small, 0.85rem);
      }

      .inbox-error {
        color: var(--danger, #b91c1c);
      }

      .retry {
        cursor: pointer;
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: var(--personality-input-radius, 8px);
        background: transparent;
        color: inherit;
        font: inherit;
        padding: 4px 12px;
      }
    `,
  ],
})
export class AttentionInboxComponent {
  readonly report = input<OwnerAttentionReport | null>(null);
  readonly state = input<LoadState>('idle');
  readonly retry = output<void>();

  readonly groups = computed<InboxGroup[]>(() => {
    const byStatus = (this.report()?.items ?? []).filter(
      (item) => item.status !== 'ok' || (item.count ?? 0) > 0
    );
    const groups = new Map<string, InboxGroup>();
    for (const item of byStatus) {
      const group = groups.get(item.source) ?? {
        source: item.source,
        title: item.label.replace(/ \(.*\)$/, ''),
        items: [],
      };
      group.items.push(item);
      groups.set(item.source, group);
    }
    return [...groups.values()];
  });

  where(item: OwnerAttentionItem): string {
    const town = /\((.*)\)$/.exec(item.label)?.[1];
    return town ?? item.label;
  }

  age(item: OwnerAttentionItem): string {
    return ageOf(item.oldest);
  }
}
