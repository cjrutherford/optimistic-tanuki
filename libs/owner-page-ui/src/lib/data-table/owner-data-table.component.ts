import { Component, computed, input, output } from '@angular/core';
import {
  AgGridUiComponent,
  type ColDef,
  type GridOptions,
} from '@optimistic-tanuki/ag-grid-ui';
import { OwnerStateComponent } from '../state/owner-state.component';

/**
 * Thin wrapper over the shared ag-grid component that owns the states around
 * it. Pass `rows` as `null` until the first load finishes.
 *
 * Precedence: `error` (with Retry) over `loading` over empty over the grid,
 * so a failed load can never be mistaken for an empty list.
 */
@Component({
  selector: 'ot-owner-data-table',
  standalone: true,
  imports: [AgGridUiComponent, OwnerStateComponent],
  templateUrl: './owner-data-table.component.html',
  styleUrl: './owner-data-table.component.scss',
})
export class OwnerDataTableComponent<T = unknown> {
  readonly columns = input.required<ColDef[]>();
  readonly rows = input<T[] | null>(null);
  readonly loading = input(false);
  /** A message puts the table in its error state. */
  readonly error = input<string | null>(null);
  readonly emptyMessage = input('Nothing matches.');
  readonly emptyActionLabel = input<string>();
  readonly height = input('32rem');

  readonly rowClick = output<T>();
  readonly selectionChange = output<T[]>();
  readonly retry = output<void>();
  readonly emptyAction = output<void>();

  protected readonly data = computed(() => this.rows() ?? []);

  /** Which of the four views is showing. */
  protected readonly view = computed<'error' | 'loading' | 'empty' | 'grid'>(
    () => {
      if (this.error()) return 'error';
      if (this.loading() || this.rows() === null) return 'loading';
      return this.data().length === 0 ? 'empty' : 'grid';
    }
  );

  readonly gridOptions: GridOptions = {
    onRowClicked: (event) => {
      if (event.data !== undefined) this.rowClick.emit(event.data as T);
    },
  };

  protected onSelection(rows: unknown[]): void {
    this.selectionChange.emit(rows as T[]);
  }
}
