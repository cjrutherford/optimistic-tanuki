import {
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

let nextId = 0;

/**
 * Search box plus projected filter controls and a Clear button.
 *
 * Typing emits `query` after a pause (default 300 ms). Clear empties the box,
 * emits an empty query at once and emits `cleared` so the page can reset the
 * filters it projected in.
 */
@Component({
  selector: 'ot-owner-filter-bar',
  standalone: true,
  templateUrl: './owner-filter-bar.component.html',
  styleUrl: './owner-filter-bar.component.scss',
})
export class OwnerFilterBarComponent {
  readonly label = input('Search');
  readonly placeholder = input('Search');
  readonly debounceMs = input(300);

  /** Debounced search text. */
  readonly query = output<string>();
  /** Clear was pressed; reset any projected filters. */
  readonly cleared = output<void>();

  protected readonly inputId = `ot-owner-filter-${nextId++}`;
  protected readonly text = signal('');

  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastEmitted = '';

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected onInput(value: string): void {
    this.text.set(value);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.emit(value), this.debounceMs());
  }

  protected clear(): void {
    clearTimeout(this.timer);
    this.text.set('');
    this.emit('');
    this.cleared.emit();
  }

  private emit(value: string): void {
    const next = value.trim();
    if (next === this.lastEmitted) return;
    this.lastEmitted = next;
    this.query.emit(next);
  }
}
