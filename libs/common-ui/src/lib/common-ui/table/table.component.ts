import {
  Component,
  Input,
  Output,
  EventEmitter,
  TemplateRef,
  OnInit,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';

/**
 * Table column configuration
 */
export interface TableColumn {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  template?: TemplateRef<unknown>;
  type?: 'text' | 'badge' | 'template';
}

/**
 * Table row action
 * @deprecated Use TableAction instead
 */
export interface TableRowAction {
  title: string;
  action: (index: number) => void | Promise<void>;
}

/**
 * Table action (new standardized interface)
 */
export interface TableAction {
  label: string;
  action: (row: unknown, index: number) => void;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: (row: unknown) => boolean;
}

/**
 * Table row data
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TableRow = Record<string, any>;

/**
 * Table cell configuration
 * @deprecated Will be removed in v2.0. Use TableColumn instead
 */
export interface TableCell {
  heading?: string;
  value?: string | TemplateRef<HTMLElement>;
  isBadge?: boolean;
  isOverflowable?: boolean;
  customStyles?: { [key: string]: string };
  isSpacer?: boolean;
}

/**
 * Sort configuration
 */
export interface TableSort {
  column: string;
  direction: 'asc' | 'desc';
}

/**
 * Standardized Table Component
 *
 * Fully accessible semantic table with sorting, selection, and theme support.
 *
 * @example
 * ```html
 * <otui-table
 *   [columns]="columns"
 *   [data]="rows"
 *   [selectable]="true"
 *   [sortable]="true"
 *   [striped]="true"
 *   (rowSelect)="onSelect($event)"
 *   (sort)="onSort($event)"
 * ></otui-table>
 * ```
 */
@Component({
  selector: 'otui-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './table.component.html',
  styleUrls: ['./table.component.scss'],
  host: {
    '[class.theme]': 'theme',
    '[class.variant]': 'variant',
    '[class.striped]': 'striped',
    '[class.compact]': 'compact',
    '[class.hoverable]': 'hoverable',
    '[class.selectable]': 'selectable',
    '[style.--local-background]': 'background',
    '[style.--local-foreground]': 'foreground',
    '[style.--local-accent]': 'accent',
    '[style.--local-complement]': 'complement',
    '[style.--local-border-color]': 'borderColor',
    '[style.--local-transition-duration]': 'transitionDuration',
  },
})
export class TableComponent extends Themeable implements OnInit, OnChanges {
  // ==================== NEW STANDARD INPUTS ====================

  /** Column definitions */
  @Input() columns: TableColumn[] = [];

  /** Table data - array of objects */
  @Input() data: TableRow[] = [];

  /** Table variant */
  @Input() variant: 'default' | 'bordered' | 'striped' | 'minimal' = 'default';

  /** Enable row hover effects */
  @Input() hoverable = true;

  /** Enable row selection */
  @Input() selectable = false;

  /** Enable column sorting */
  @Input() sortable = false;

  /** Enable striped rows */
  @Input() striped = false;

  /** Compact spacing */
  @Input() compact = false;

  /** Sticky header */
  @Input() stickyHeader = false;

  /** Row actions */
  @Input() actions: TableAction[] = [];

  /** Empty state message */
  @Input() emptyMessage = 'No data available';

  /** ARIA label for the table */
  @Input() ariaLabel?: string;

  /** ARIA labelledby reference */
  @Input() ariaLabelledBy?: string;

  /** ARIA describedby reference */
  @Input() ariaDescribedBy?: string;

  /** Caption text for accessibility */
  @Input() caption?: string;

  // ==================== OUTPUTS ====================

  /** Emitted when row selection changes */
  @Output() rowSelect = new EventEmitter<TableRow[]>();

  /** Emitted when sort changes */
  @Output() sort = new EventEmitter<TableSort>();

  /** Emitted when row is clicked */
  @Output() rowClick = new EventEmitter<{ row: TableRow; index: number }>();

  // ==================== DEPRECATED INPUTS (Backward Compatibility) ====================

  /**
   * @deprecated Use 'data' input instead. Will be removed in v2.0.
   * Legacy single row cells - maintained for backward compatibility
   */
  @Input() set cells(value: TableCell[]) {
    if (value && value.length > 0) {
      console.warn(
        '[otui-table] Warning: "cells" input is deprecated. Use "data" (array of rows) and "columns" (column definitions) instead. Will be removed in v2.0.'
      );
      this._legacyCells = value;
      this._convertLegacyCellsToColumns(value);
    }
  }
  get cells(): TableCell[] {
    return this._legacyCells;
  }
  _legacyCells: TableCell[] = [];

  /**
   * @deprecated Use 'actions' input instead. Will be removed in v2.0.
   * Legacy row actions
   */
  @Input() set rowActions(value: TableRowAction[] | undefined) {
    if (value) {
      console.warn(
        '[otui-table] Warning: "rowActions" input is deprecated. Use "actions" instead with TableAction interface. Will be removed in v2.0.'
      );
      this._legacyRowActions = value;
      this._convertLegacyActions(value);
    }
  }
  get rowActions(): TableRowAction[] | undefined {
    return this._legacyRowActions;
  }
  _legacyRowActions?: TableRowAction[];

  /**
   * @deprecated No longer needed. Will be removed in v2.0.
   * Legacy row index
   */
  @Input() set rowIndex(value: number) {
    console.warn(
      '[otui-table] Warning: "rowIndex" input is deprecated and has no effect in the new table API. Will be removed in v2.0.'
    );
    this._legacyRowIndex = value;
  }
  get rowIndex(): number {
    return this._legacyRowIndex;
  }
  _legacyRowIndex = 0;

  /**
   * @deprecated Use CSS variables or variant input instead. Will be removed in v2.0.
   * Legacy table styles
   */
  @Input() set tableStyles(value: { [key: string]: string }) {
    if (Object.keys(value).length > 0) {
      console.warn(
        '[otui-table] Warning: "tableStyles" input is deprecated. Use CSS variables (--local-*) or variant input instead. Will be removed in v2.0.'
      );
      this._legacyTableStyles = value;
    }
  }
  get tableStyles(): { [key: string]: string } {
    return this._legacyTableStyles;
  }
  _legacyTableStyles: { [key: string]: string } = {};

  /**
   * @deprecated No longer needed. Will be removed in v2.0.
   * Legacy spacer flag
   */
  @Input() set spacer(value: boolean) {
    if (value) {
      console.warn(
        '[otui-table] Warning: "spacer" input is deprecated and has no effect in the new table API. Use column width instead. Will be removed in v2.0.'
      );
    }
    this._legacySpacer = value;
  }
  get spacer(): boolean {
    return this._legacySpacer;
  }
  _legacySpacer = false;

  /**
   * @deprecated No longer needed. Will be removed in v2.0.
   * Legacy show actions split
   */
  @Input() set showActionsSplit(value: boolean) {
    console.warn(
      '[otui-table] Warning: "showActionsSplit" input is deprecated. All actions are now shown inline or in dropdown. Will be removed in v2.0.'
    );
  }

  // ==================== INTERNAL STATE ====================

  /** Selected rows */
  selectedRows = new Set<TableRow>();

  /** Current sort state */
  currentSort?: TableSort;

  /** Legacy template refs */
  cellTemplates: (TemplateRef<HTMLElement> | null)[] = [];

  /** Legacy action popup visibility */
  showActions = false;

  /** Legacy row expansion */
  rowExpanded = false;

  // ==================== LIFECYCLE ====================

  override ngOnInit(): void {
    // Check if using legacy API
    if (this._legacyCells.length > 0 && this.data.length === 0) {
      console.warn(
        '[otui-table] You are using the deprecated single-row API. Please migrate to the new multi-row API with "data" and "columns" inputs.'
      );
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] || changes['columns']) {
      this.selectedRows.clear();
      this.rowSelect.emit([]);
    }
  }

  // ==================== THEME ====================

  override applyTheme(colors: ThemeColors): void {
    this.background = colors.background;
    this.foreground = colors.foreground;
    this.accent = colors.accent;
    this.complement = colors.complementary;
    this.borderColor = colors.complementary;
    this.transitionDuration = '0.15s';
  }

  // ==================== SORTING ====================

  handleSort(column: TableColumn): void {
    if (!column.sortable || !this.sortable) return;

    let direction: 'asc' | 'desc' = 'asc';

    if (this.currentSort?.column === column.key) {
      direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
    }

    this.currentSort = { column: column.key, direction };
    this.sort.emit(this.currentSort);
  }

  getSortIndicator(column: TableColumn): string {
    if (!this.currentSort || this.currentSort.column !== column.key) {
      return '↕️';
    }
    return this.currentSort.direction === 'asc' ? '↑' : '↓';
  }

  // ==================== SELECTION ====================

  toggleRowSelection(row: TableRow): void {
    if (!this.selectable) return;

    if (this.selectedRows.has(row)) {
      this.selectedRows.delete(row);
    } else {
      this.selectedRows.add(row);
    }

    this.rowSelect.emit(Array.from(this.selectedRows));
  }

  toggleAllSelection(): void {
    if (!this.selectable) return;

    if (this.selectedRows.size === this.data.length) {
      this.selectedRows.clear();
    } else {
      this.data.forEach((row) => this.selectedRows.add(row));
    }

    this.rowSelect.emit(Array.from(this.selectedRows));
  }

  isRowSelected(row: TableRow): boolean {
    return this.selectedRows.has(row);
  }

  areAllSelected(): boolean {
    return this.data.length > 0 && this.selectedRows.size === this.data.length;
  }

  // ==================== ROW ACTIONS ====================

  handleRowClick(row: TableRow, index: number): void {
    this.rowClick.emit({ row, index });
  }

  executeAction(action: TableAction, row: TableRow, index: number): void {
    action.action(row, index);
  }

  isActionDisabled(action: TableAction, row: TableRow): boolean {
    return action.disabled ? action.disabled(row) : false;
  }

  // ==================== LEGACY CONVERSION ====================

  private _convertLegacyCellsToColumns(cells: TableCell[]): void {
    // Convert legacy cells to new column format
    this.columns = cells.map((cell, index) => ({
      key: `col${index}`,
      header: cell.heading || `Column ${index + 1}`,
      type: cell.isBadge ? 'badge' : 'text',
      align: 'left',
    }));

    // Convert legacy single row to data array
    if (cells.length > 0) {
      const row: TableRow = {};
      cells.forEach((cell, index) => {
        row[`col${index}`] = cell.value;
      });
      this.data = [row];
    }
  }

  private _convertLegacyActions(actions: TableRowAction[]): void {
    this.actions = actions.map((action) => ({
      label: action.title,
      action: (row: unknown, index: number) => action.action(index),
    }));
  }

  // ==================== UTILITY ====================

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  isTemplateRef(value: any): value is TemplateRef<HTMLElement> {
    return value instanceof TemplateRef;
  }

  toggleActions(): void {
    this.showActions = !this.showActions;
  }

  toggleRowExpansion(): void {
    this.rowExpanded = !this.rowExpanded;
  }

  get hasOverflowableCells(): boolean {
    return this._legacyCells.some((cell) => cell.isOverflowable);
  }

  // Legacy method
  executeLegacyAction(action: TableRowAction): void {
    action.action(this._legacyRowIndex);
    this.showActions = false;
  }
}
