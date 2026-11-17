import { Component, computed, input, output, signal } from '@angular/core';
import { DirectoryFilters } from '../models';
import { humanizeCategory } from '../state';

/**
 * Search, category and adult-opt-in controls. Presentational: it emits the filters the visitor submitted and
 * the page decides what to do (normally write them to the URL). Submitting announces what is being searched.
 */
@Component({
  selector: 'otd-directory-filter-bar',
  standalone: true,
  template: `
    <form
      class="bar"
      role="search"
      aria-label="Search the business directory"
      (submit)="submit($event, q.value, category.value, adult.checked)"
    >
      <div class="bar__field">
        <label for="otd-q">Search businesses</label>
        <input
          #q
          id="otd-q"
          name="q"
          type="search"
          maxlength="100"
          placeholder="Search by name or service"
          [value]="value().q"
        />
      </div>
      <div class="bar__field">
        <label for="otd-category">Category</label>
        <select #category id="otd-category" name="category">
          <option value="" [selected]="!value().category">
            All categories
          </option>
          @for (option of options(); track option) {
          <option [value]="option" [selected]="option === value().category">
            {{ label(option) }}
          </option>
          }
        </select>
      </div>
      <div class="bar__check">
        <input
          #adult
          id="otd-adult"
          name="adult"
          type="checkbox"
          [checked]="value().adult"
        />
        <label for="otd-adult">Include adult-oriented businesses</label>
      </div>
      <div class="bar__actions">
        <button type="submit" class="bar__submit">Search</button>
        @if (active()) {
        <button
          type="button"
          class="bar__clear"
          data-testid="filters-clear"
          (click)="clear()"
        >
          Clear filters
        </button>
        }
      </div>
      <p
        class="bar__announce"
        role="status"
        aria-live="polite"
        data-testid="filter-announcement"
      >
        {{ announcement() }}
      </p>
    </form>
  `,
  styleUrls: ['./directory-filter-bar.component.scss'],
})
export class DirectoryFilterBarComponent {
  readonly value = input<DirectoryFilters>({
    q: '',
    category: '',
    adult: false,
  });
  /** Category identifiers that can be chosen (for example the ones seen in loaded results). */
  readonly categories = input<readonly string[]>([]);

  readonly filtersSubmit = output<DirectoryFilters>();

  readonly announcement = signal('');

  /** Always includes the chosen category so a deep link never loses its selection. */
  readonly options = computed(() => {
    const chosen = this.value().category;
    const all = new Set(this.categories());
    if (chosen) all.add(chosen);
    return [...all].sort((a, b) => a.localeCompare(b));
  });
  readonly active = computed(() => {
    const v = this.value();
    return !!(v.q || v.category || v.adult);
  });

  label(category: string): string {
    return humanizeCategory(category);
  }

  submit(event: Event, q: string, category: string, adult: boolean): void {
    event.preventDefault();
    const filters = { q: q.trim(), category, adult };
    this.announcement.set(describe(filters));
    this.filtersSubmit.emit(filters);
  }

  clear(): void {
    this.announcement.set('Filters cleared. Showing all businesses.');
    this.filtersSubmit.emit({ q: '', category: '', adult: false });
  }
}

function describe(filters: DirectoryFilters): string {
  const parts: string[] = [];
  if (filters.q) parts.push(`“${filters.q}”`);
  if (filters.category) parts.push(humanizeCategory(filters.category));
  if (filters.adult) parts.push('including adult-oriented businesses');
  return parts.length
    ? `Searching businesses: ${parts.join(', ')}`
    : 'Showing all businesses';
}
