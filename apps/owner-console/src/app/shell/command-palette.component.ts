import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { OwnerNavEntry, searchNav } from '../owner-nav';

/**
 * Ctrl/Cmd-K palette over the nav tree. A combobox input drives a listbox; the
 * focused option is tracked with `aria-activedescendant` so focus stays in the
 * input. Esc or a scrim click closes it; Enter opens the highlighted page.
 */
@Component({
  selector: 'app-command-palette',
  standalone: true,
  template: `
    @if (open()) {
    <div class="scrim" (click)="closed.emit()" aria-hidden="true"></div>
    <div
      class="palette"
      role="dialog"
      aria-modal="true"
      aria-label="Go to page"
      (keydown)="onKeydown($event)"
    >
      <input
        #field
        class="field"
        type="text"
        role="combobox"
        aria-label="Search pages"
        aria-autocomplete="list"
        aria-expanded="true"
        aria-controls="palette-results"
        autocomplete="off"
        placeholder="Go to a page…"
        [attr.aria-activedescendant]="activeId()"
        [value]="query()"
        (input)="setQuery($any($event.target).value)"
      />
      <ul id="palette-results" class="results" role="listbox">
        @for (entry of results(); track $index; let i = $index) {
        <li
          role="option"
          class="option"
          [id]="optionId(i)"
          [class.option--active]="i === activeIndex()"
          [attr.aria-selected]="i === activeIndex()"
          (mouseenter)="activeIndex.set(i)"
          (click)="choose(entry)"
        >
          <span class="option-label">{{ entry.leaf.label }}</span>
          <span class="option-group">{{
            entry.hint
              ? entry.group.label + ' · ' + entry.hint
              : entry.group.label
          }}</span>
        </li>
        } @empty {
        <li class="empty" role="presentation">No matching pages</li>
        }
      </ul>
    </div>
    }
  `,
  styles: [
    `
      .scrim {
        position: fixed;
        inset: 0;
        z-index: 60;
        background: color-mix(in srgb, var(--foreground) 45%, transparent);
      }

      .palette {
        position: fixed;
        top: 12vh;
        left: 50%;
        z-index: 61;
        width: min(36rem, calc(100vw - 2rem));
        transform: translateX(-50%);
        overflow: hidden;
        border: 1px solid var(--border-color);
        border-radius: var(--personality-card-radius, 12px);
        background: var(--surface);
        color: var(--foreground);
        font-family: var(--font-body, inherit);
        font-size: var(--type-body, 1rem);
        box-shadow: var(
          --personality-card-shadow,
          0 16px 40px rgb(0 0 0 / 0.3)
        );
      }

      .field {
        box-sizing: border-box;
        width: 100%;
        padding: 14px 16px;
        border: 0;
        border-bottom: 1px solid var(--border-color);
        background: transparent;
        color: inherit;
        font: inherit;
      }

      .field:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: -2px;
      }

      .results {
        max-height: 50vh;
        margin: 0;
        padding: 6px;
        overflow-y: auto;
        list-style: none;
      }

      .option {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 10px;
        border-radius: var(--personality-input-radius, 8px);
        cursor: pointer;
      }

      .option--active {
        background: color-mix(in srgb, var(--primary) 18%, transparent);
      }

      .option-group {
        font-size: var(--type-small, 0.85rem);
        opacity: 0.7;
      }

      .empty {
        padding: 12px 10px;
        opacity: 0.7;
      }
    `,
  ],
})
export class CommandPaletteComponent {
  readonly open = input(false);
  readonly entries = input.required<readonly OwnerNavEntry[]>();

  /** Esc, scrim click, or after a page was chosen. */
  readonly closed = output<void>();
  readonly chosen = output<OwnerNavEntry>();

  readonly query = signal('');
  readonly activeIndex = signal(0);
  readonly results = computed(() => searchNav(this.query(), this.entries()));
  readonly activeId = computed(() =>
    this.results().length > 0 ? this.optionId(this.activeIndex()) : null
  );

  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  constructor() {
    effect(() => {
      if (this.open()) {
        this.query.set('');
        this.activeIndex.set(0);
        // The input only exists after the dialog renders.
        setTimeout(() => this.field()?.nativeElement.focus());
      }
    });
  }

  optionId(index: number): string {
    return `palette-option-${index}`;
  }

  setQuery(value: string): void {
    this.query.set(value);
    this.activeIndex.set(0);
  }

  choose(entry: OwnerNavEntry): void {
    this.chosen.emit(entry);
    this.closed.emit();
  }

  onKeydown(event: KeyboardEvent): void {
    const count = this.results().length;
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.closed.emit();
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (count) this.activeIndex.set((this.activeIndex() + 1) % count);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (count)
          this.activeIndex.set((this.activeIndex() - 1 + count) % count);
        break;
      case 'Home':
        event.preventDefault();
        this.activeIndex.set(0);
        break;
      case 'End':
        event.preventDefault();
        this.activeIndex.set(Math.max(count - 1, 0));
        break;
      case 'Enter': {
        event.preventDefault();
        const entry = this.results()[this.activeIndex()];
        if (entry) this.choose(entry);
        break;
      }
    }
  }
}
