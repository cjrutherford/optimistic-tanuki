import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  signal,
  computed,
  WritableSignal,
  ViewEncapsulation,
} from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  GridOptions,
  GridReadyEvent,
  GridApi,
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
} from 'ag-grid-community';
import {
  Themeable,
  ThemeColors,
  ThemeService,
} from '@optimistic-tanuki/theme-lib';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

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
  standalone: true,
  imports: [AgGridAngular],
  templateUrl: './ag-grid-ui.component.html',
  styleUrls: ['./ag-grid-ui.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class AgGridUiComponent
  extends Themeable
  implements OnInit, OnDestroy, OnChanges
{
  /** Row data to display in the grid */
  @Input() rowData: any[] = [];

  /** Column definitions for the grid */
  @Input() columnDefs: ColDef[] = [];

  /** Custom grid options (merged with defaults) */
  @Input() gridOptions?: GridOptions;

  /** Optional loading hint; when true the AG Grid loading overlay will be shown */
  @Input() loading?: boolean = false;
  /** Height of the grid (default: 500px) */
  @Input() height = '500px';

  /** Width of the grid (default: 100%) */
  @Input() width = '100%';

  /** Grid API instance (available after grid is ready) */
  public gridApi?: GridApi;

  // Internal signals for reactive data flow
  rowDataSignal: WritableSignal<any[]> = signal([]);
  columnDefsSignal: WritableSignal<ColDef[]> = signal([]);
  private gridOptionsSignal: WritableSignal<GridOptions | undefined> =
    signal(undefined);
  private loadingSignal = signal(false);

  // AG Grid theme instance (created with themeQuartz)
  private gridThemeSignal = signal<any>(themeQuartz);

  /** Default grid options with reasonable defaults */
  public defaultGridOptions: GridOptions = {
    // Pagination
    pagination: true,
    paginationPageSize: 10,
    paginationPageSizeSelector: [10, 25, 50, 100],

    // Sorting
    // sortingOrder is deprecated at the top-level; move to defaultColDef

    // Filtering
    defaultColDef: {
      sortable: true,
      filter: true,
      resizable: true,
      flex: 1,
      minWidth: 100,
      // recommended place for sortingOrder
      sortingOrder: ['asc', 'desc', null],
    },

    // Selection
    // Use the object form for rowSelection in newer AG Grid versions
    rowSelection: { mode: 'multiRow' },
    // suppressRowClickSelection is deprecated; preserve previous intent via comments

    // Animation
    animateRows: true,

    // Other
    enableCellTextSelection: true,
    ensureDomOrder: true,
    // Default loading overlay template
    overlayLoadingTemplate:
      '<span class="ag-overlay-loading-center">Loading...</span>',
  };

  override applyTheme(colors: ThemeColors): void {
    this.background = colors.background;
    this.foreground = colors.foreground;
    this.accent = colors.accent;
    this.complement = colors.complementary;
    this.borderColor = colors.complementaryShades[2][1];

    // Create AG Grid theme using the new themeQuartz API
    const isDark = this.theme === 'dark';

    const newTheme = themeQuartz.withParams({
      // Base colors
      accentColor: colors.accent,
      backgroundColor: colors.background,
      foregroundColor: colors.foreground,
      borderColor: colors.complementaryShades[2][1],

      // Chrome colors (headers, tool panels, etc)
      chromeBackgroundColor: isDark
        ? colors.accentShades[9][1]
        : colors.accentShades[0][1],

      // Header styling
      headerBackgroundColor: isDark
        ? colors.accentShades[8][1]
        : colors.accentShades[2][1],
      headerTextColor: colors.foreground,
      headerCellHoverBackgroundColor: isDark
        ? colors.accentShades[7][1]
        : colors.accentShades[1][1],

      // Row styling
      oddRowBackgroundColor: isDark
        ? colors.accentShades[9][1]
        : colors.accentShades[0][1],
      rowHoverColor: isDark
        ? colors.accentShades[7][1]
        : colors.accentShades[1][1],
      selectedRowBackgroundColor: isDark
        ? colors.accentShades[6][1]
        : colors.accentShades[2][1],

      // Spacing
      spacing: 6,
      cellHorizontalPadding: 12,
      headerHeight: 48,
      rowHeight: 42,

      // Typography
      fontSize: 14,
      fontFamily: 'inherit',

      // Borders
      borderRadius: 4,
      wrapperBorderRadius: 4,
    });

    this.gridThemeSignal.set(newTheme);

    // Apply theme dynamically if grid is already ready
    if (this.gridApi) {
      this.gridApi.setGridOption('theme', newTheme);
      this.gridApi.refreshCells();
    }

    console.log('AG Grid theme applied:', { theme: this.theme, isDark });
  }

  /**
   * Called when the grid is ready
   * Stores API reference and applies any initial sizing
   */
  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;

    // Auto-size columns to fit current viewport/content
    if (this.gridApi) {
      try {
        this.gridApi.sizeColumnsToFit();
        this.gridApi.setGridOption('theme', this.gridThemeSignal());
      } catch (e) {
        console.warn('ag-grid: sizeColumnsToFit failed', e);
      }
    }

    // Apply loading state if set
    if (this.loadingSignal()) {
      this.gridApi?.showLoadingOverlay();
    } else {
      this.gridApi?.hideOverlay();
    }

    // Make sure the latest theme is applied if it was loaded before gridReady
    const currentTheme = this.gridThemeSignal();
    if (currentTheme) {
      this.gridApi?.setGridOption('theme', currentTheme);
      if (this.gridApi && typeof (this.gridApi as any).refreshCells === 'function') {
        (this.gridApi as any).refreshCells();
      }
    }

    console.log(
      'ag-grid: onGridReady, displayedRows=',
      this.gridApi?.getDisplayedRowCount()
    );
  }

  /**
   * Get the merged grid options (defaults + custom)
   */
  mergedGridOptions = computed(() => {
    // prefer explicit values from provided gridOptions, otherwise fall back to signals and defaults
    const provided = this.gridOptionsSignal() || {};
    const theme = this.gridThemeSignal();

    const opts: GridOptions = {
      ...this.defaultGridOptions,
      ...provided,
      // Perform a shallow merge of defaultColDef to avoid overwriting defaults
      defaultColDef: {
        ...(this.defaultGridOptions.defaultColDef || {}),
        ...(provided.defaultColDef || {}),
      },
      // Apply the theme using the new AG Grid API
      theme: theme || themeQuartz,
    } as GridOptions;

    return opts;
  });
  override ngOnInit(): void {
    super.ngOnInit();
    // Initialize signals with current input values
    this.rowDataSignal.set(this.rowData || []);
    this.columnDefsSignal.set(this.columnDefs || []);
    this.gridOptionsSignal.set(this.gridOptions);
    this.loadingSignal.set(!!this.loading);
    console.log('ag-grid: ngOnInit', {
      rowData: this.rowData?.length,
      columnDefs: this.columnDefs?.length,
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rowData']) {
      this.rowDataSignal.set(this.rowData || []);
      console.log('ag-grid: rowData updated', (this.rowData || []).length);
    }
    if (changes['columnDefs']) {
      this.columnDefsSignal.set(this.columnDefs || []);
      console.log(
        'ag-grid: columnDefs updated',
        (this.columnDefs || []).length
      );
    }
    if (changes['gridOptions']) {
      this.gridOptionsSignal.set(this.gridOptions);
      console.log('ag-grid: gridOptions updated');
    }
    if (changes['loading']) {
      this.loadingSignal.set(!!this.loading);
      // If grid is already ready, show/hide overlay immediately
      if (this.gridApi) {
        if (this.loadingSignal()) {
          this.gridApi.showLoadingOverlay();
        } else {
          this.gridApi.hideOverlay();
        }
      }
    }
  }
}
