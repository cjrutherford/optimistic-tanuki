import { ColDef, GridOptions, ValueFormatterParams } from 'ag-grid-community';

/**
 * Utility functions for AG Grid configurations
 */

/**
 * Creates a date column definition with formatting
 */
export function createDateColumn(
  field: string,
  headerName?: string,
  options?: Partial<ColDef>
): ColDef {
  return {
    field,
    headerName: headerName || field,
    valueFormatter: (params: ValueFormatterParams) => {
      if (!params.value) return '';
      const date = new Date(params.value);
      return date.toLocaleDateString();
    },
    filter: 'agDateColumnFilter',
    ...options,
  };
}

/**
 * Creates a date-time column definition with formatting
 */
export function createDateTimeColumn(
  field: string,
  headerName?: string,
  options?: Partial<ColDef>
): ColDef {
  return {
    field,
    headerName: headerName || field,
    valueFormatter: (params: ValueFormatterParams) => {
      if (!params.value) return '';
      const date = new Date(params.value);
      return date.toLocaleString();
    },
    filter: 'agDateColumnFilter',
    ...options,
  };
}

/**
 * Creates a status/badge column definition
 */
export function createStatusColumn(
  field: string,
  headerName?: string,
  options?: Partial<ColDef>
): ColDef {
  return {
    field,
    headerName: headerName || field,
    // Use text filter in the community edition to avoid requiring SetFilterModule
    filter: 'agTextColumnFilter',
    cellStyle: { fontWeight: 'bold', textTransform: 'uppercase' },
    ...options,
  };
}

/**
 * Creates an actions column with custom cell renderer
 */
export function createActionsColumn(
  cellRenderer: unknown,
  options?: Partial<ColDef>
): ColDef {
  return {
    headerName: 'Actions',
    cellRenderer,
    sortable: false,
    filter: false,
    resizable: false,
    maxWidth: 150,
    pinned: 'right',
    ...options,
  };
}

/**
 * Creates grid options with common configurations
 */
export function createGridOptions(
  customOptions?: GridOptions
): GridOptions {
  return {
    pagination: true,
    paginationPageSize: 10,
    paginationPageSizeSelector: [10, 25, 50, 100],
    sortingOrder: ['asc', 'desc', null],
    defaultColDef: {
      sortable: true,
      filter: true,
      resizable: true,
      flex: 1,
      minWidth: 100,
    },
    rowSelection: { mode: 'multiRow' },
    // suppressRowClickSelection is deprecated; preserve previous intent
    // by not enabling click selection on the default object.
    animateRows: true,
    enableCellTextSelection: true,
    ensureDomOrder: true,
    ...customOptions,
  };
}

/**
 * Helper to convert table data to AG Grid column definitions
 */
export function generateColumnsFromData<T extends Record<string, unknown>>(
  data: T[],
  excludeFields: string[] = [],
  customColumns: Record<string, Partial<ColDef>> = {}
): ColDef[] {
  if (!data || data.length === 0) return [];
  
  const firstRow = data[0];
  const fields = Object.keys(firstRow).filter(
    (field) => !excludeFields.includes(field)
  );
  
  return fields.map((field) => ({
    field,
    headerName: field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1'),
    ...(customColumns[field] || {}),
  }));
}
