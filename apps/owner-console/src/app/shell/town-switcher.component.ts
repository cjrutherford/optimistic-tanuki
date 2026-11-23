import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  TownContextService,
  swapTownInUrl,
} from '../services/town-context.service';

/**
 * Town switcher for the app bar. Picking a town sets the context; on a town
 * page it also moves to the same tab under the new town.
 */
@Component({
  selector: 'app-town-switcher',
  standalone: true,
  template: `
    <label class="switcher">
      <span class="label">Town</span>
      @if (context.status() === 'error') {
      <button type="button" class="retry" (click)="context.load(true)">
        Towns unavailable, retry
      </button>
      } @else {
      <select
        class="select"
        aria-label="Town"
        [disabled]="context.status() !== 'ready'"
        [value]="context.selected()?.id ?? ''"
        (change)="choose($any($event.target).value)"
      >
        <option value="" [selected]="!context.selected()">
          {{ context.status() === 'ready' ? 'No town selected' : 'Loading…' }}
        </option>
        @for (town of context.towns(); track town.id) {
        <option
          [value]="town.id"
          [selected]="town.id === context.selected()?.id"
        >
          {{ town.name }}
        </option>
        }
      </select>
      @if (context.partial()) {
      <button type="button" class="retry" (click)="context.load(true)">
        Some towns could not be loaded, retry
      </button>
      } }
    </label>
  `,
  styles: [
    `
      .switcher {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-family: var(--font-body, inherit);
        font-size: var(--type-small, 0.875rem);
        color: inherit;
      }

      .select,
      .retry {
        max-width: 14rem;
        padding: 6px 8px;
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: var(--personality-input-radius, 8px);
        background: var(--surface, #ffffff);
        color: var(--foreground, #111827);
        font: inherit;
      }

      .select:focus-visible,
      .retry:focus-visible {
        outline: 2px solid var(--primary, #2563eb);
        outline-offset: 2px;
      }
    `,
  ],
})
export class TownSwitcherComponent implements OnInit {
  readonly context = inject(TownContextService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.context.load();
  }

  choose(id: string): void {
    this.context.select(id || null);
    const next = id ? swapTownInUrl(this.router.url, id) : null;
    if (next) {
      void this.router.navigateByUrl(next);
    }
  }
}
