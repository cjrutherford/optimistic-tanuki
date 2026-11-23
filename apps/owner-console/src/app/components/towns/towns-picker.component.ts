import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Town, TownContextService } from '../../services/town-context.service';

/** Lists every town; choosing one sets the town context and opens it. */
@Component({
  selector: 'app-towns-picker',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="picker">
      <header>
        <h1>Towns</h1>
        <p>
          Pick a town to review its boundary, directory queues and communities.
          The town you pick stays selected while you move between pages.
        </p>
      </header>

      <label class="search">
        <span>Search towns</span>
        <input
          type="search"
          [ngModel]="query()"
          (ngModelChange)="query.set($event)"
          placeholder="Name or region"
        />
      </label>

      @switch (context.status()) { @case ('error') {
      <div class="state" role="alert">
        <p>Towns are unavailable right now.</p>
        <button type="button" (click)="context.load(true)">Retry</button>
      </div>
      } @case ('ready') {
      <ul class="towns" aria-label="Towns">
        @for (town of filtered(); track town.id) {
        <li>
          <button
            type="button"
            class="town"
            [class.town--current]="town.id === context.selectedId()"
            [attr.aria-current]="
              town.id === context.selectedId() ? 'true' : null
            "
            (click)="open(town)"
          >
            <strong>{{ town.name }}</strong>
            <span>{{ town.subtitle }}</span>
            @if (town.id === context.selectedId()) {
            <em>Selected</em>
            }
          </button>
        </li>
        } @empty {
        <li class="state">No towns match.</li>
        }
      </ul>
      } @default {
      <p class="state" role="status">Loading towns…</p>
      } }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        color: var(--foreground, #111827);
        font-family: var(--font-body, inherit);
      }

      h1 {
        margin: 0 0 8px;
        font-family: var(--font-heading, inherit);
        font-size: var(--type-h2, 1.5rem);
      }

      .search {
        display: grid;
        gap: 4px;
        max-width: 24rem;
        margin: 16px 0;
        font-size: var(--type-small, 0.875rem);
      }

      input {
        padding: 8px 10px;
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: var(--personality-input-radius, 8px);
        background: var(--surface, #ffffff);
        color: inherit;
        font: inherit;
      }

      .towns {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
        gap: 12px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .town {
        display: grid;
        gap: 4px;
        width: 100%;
        padding: 14px;
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: var(--personality-card-radius, 14px);
        background: var(--surface, #ffffff);
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      .town:hover,
      .town--current {
        border-color: var(--primary, #2563eb);
      }

      .town:focus-visible,
      button:focus-visible,
      input:focus-visible {
        outline: 2px solid var(--primary, #2563eb);
        outline-offset: 2px;
      }

      .town span,
      .town em {
        font-size: var(--type-small, 0.875rem);
        opacity: 0.8;
      }

      .state {
        padding: 12px 0;
      }
    `,
  ],
})
export class TownsPickerComponent implements OnInit {
  readonly context = inject(TownContextService);
  private readonly router = inject(Router);

  readonly query = signal('');
  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.context
      .towns()
      .filter(
        (town) =>
          !q || `${town.name} ${town.subtitle}`.toLowerCase().includes(q)
      );
  });

  ngOnInit(): void {
    this.context.load();
  }

  open(town: Town): void {
    this.context.select(town.id);
    void this.router.navigate(['/dashboard/towns', town.id, 'overview']);
  }
}
