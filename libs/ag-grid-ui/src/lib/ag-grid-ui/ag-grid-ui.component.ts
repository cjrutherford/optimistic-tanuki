import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  GridOptions,
  GridReadyEvent,
  GridApi,
} from 'ag-grid-community';
import { Themeable, ThemeColors, ThemeService } from '@optimistic-tanuki/theme-lib';

/**
 * Theme-aware AG Grid wrapper component with reasonable defaults
 * 
 * This component provides:
 * - Automatic theme integration with the application's ThemeService
 * - Reasonable default grid options (pagination, sorting, filtering)
 * - Customizable column definitions
 * - Easy-to-use input bindings
 */
@Component({
  selector: 'otui-ag-grid',
  imports: [AgGridAngular],
  templateUrl: './ag-grid-ui.component.html',
  styleUrl: './ag-grid-ui.component.scss',
  host: {
    '[style.--ag-background-color]': 'background',
    '[style.--ag-foreground-color]': 'foreground',
    '[style.--ag-header-background-color]': 'headerBackground',
    '[style.--ag-odd-row-background-color]': 'oddRowBackground',
    '[style.--ag-header-foreground-color]': 'headerForeground',
    '[style.--ag-border-color]': 'borderColor',
    '[style.--ag-row-hover-color]': 'rowHoverColor',
    '[style.--ag-selected-row-background-color]': 'selectedRowBackground',
    '[style.--ag-accent-color]': 'accent',
  }
})
export class AgGridUiComponent extends Themeable implements OnInit, OnDestroy {
  /** Row data to display in the grid */
  @Input() rowData: any[] = [];
  
  /** Column definitions for the grid */
  @Input() columnDefs: ColDef[] = [];
  
  /** Custom grid options (merged with defaults) */
  @Input() gridOptions?: GridOptions;
  
  /** Height of the grid (default: 500px) */
  @Input() height: string = '500px';
  
  /** Width of the grid (default: 100%) */
  @Input() width: string = '100%';

  /** Grid API instance (available after grid is ready) */
  public gridApi?: GridApi;

  // Theme variables
  headerBackground = '';
  headerForeground = '';
  oddRowBackground = '';
  rowHoverColor = '';
  selectedRowBackground = '';

  /** Default grid options with reasonable defaults */
  public defaultGridOptions: GridOptions = {
    // Pagination
    pagination: true,
    paginationPageSize: 10,
    paginationPageSizeSelector: [10, 25, 50, 100],
    
    // Sorting
    sortingOrder: ['asc', 'desc', null],
    
    // Filtering
    defaultColDef: {
      sortable: true,
      filter: true,
      resizable: true,
      flex: 1,
      minWidth: 100,
    },
    
    // Selection
    rowSelection: 'multiple',
    suppressRowClickSelection: true,
    
    // Animation
    animateRows: true,
    
    // Other
    enableCellTextSelection: true,
    ensureDomOrder: true,
  };

  override applyTheme(colors: ThemeColors): void {
    this.background = colors.background;
    this.foreground = colors.foreground;
    this.accent = colors.accent;
    this.complement = colors.complementary;
    this.borderColor = colors.complementaryShades[2][1];
    
    if (this.theme === 'dark') {
      this.headerBackground = colors.accentShades[8][1];
      this.headerForeground = colors.foreground;
      // Use a slightly lighter background for odd rows
      this.oddRowBackground = colors.accentShades[9][1];
      this.rowHoverColor = colors.accentShades[7][1];
      this.selectedRowBackground = colors.accentShades[6][1];
    } else {
      this.headerBackground = colors.accentShades[2][1];
      this.headerForeground = colors.foreground;
      // Use a slightly darker background for odd rows
      this.oddRowBackground = colors.accentShades[0][1];
      this.rowHoverColor = colors.accentShades[1][1];
      this.selectedRowBackground = colors.accentShades[2][1];
    }
  }

  /**
   * Called when the grid is ready
   * Stores API reference and applies any initial sizing
   */
  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    
    // Auto-size all columns to fit content
    if (this.gridApi) {
      this.gridApi.sizeColumnsToFit();
    }
  }

  /**
   * Get the merged grid options (defaults + custom)
   */
  get mergedGridOptions(): GridOptions {
    return {
      ...this.defaultGridOptions,
      ...this.gridOptions,
    };
  }
}
