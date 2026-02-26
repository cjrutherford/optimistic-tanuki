import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgGridUiComponent } from './ag-grid-ui.component';
import { ColDef } from 'ag-grid-community';

describe('AgGridUiComponent', () => {
  let component: AgGridUiComponent;
  let fixture: ComponentFixture<AgGridUiComponent>;

  const mockColumnDefs: ColDef[] = [
    { field: 'name', headerName: 'Name' },
    { field: 'age', headerName: 'Age' },
    { field: 'email', headerName: 'Email' },
  ];

  const mockRowData = [
    { name: 'John Doe', age: 30, email: 'john@example.com' },
    { name: 'Jane Smith', age: 25, email: 'jane@example.com' },
    { name: 'Bob Johnson', age: 35, email: 'bob@example.com' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgGridUiComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AgGridUiComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with empty row data', () => {
    expect(component.rowData).toEqual([]);
  });

  it('should initialize with empty column defs', () => {
    expect(component.columnDefs).toEqual([]);
  });

  it('should accept row data input', () => {
    component.rowData = mockRowData;
    fixture.detectChanges();
    expect(component.rowData.length).toBe(3);
  });

  it('should accept column definitions input', () => {
    component.columnDefs = mockColumnDefs;
    fixture.detectChanges();
    expect(component.columnDefs.length).toBe(3);
  });

  it('should have default grid options', () => {
    expect(component.defaultGridOptions).toBeDefined();
    expect(component.defaultGridOptions.pagination).toBe(true);
    expect(component.defaultGridOptions.paginationPageSize).toBe(10);
  });

  it('should merge custom grid options with defaults', () => {
    component.gridOptions = {
      paginationPageSize: 25,
    };
    component.ngOnChanges({
      gridOptions: {
        currentValue: component.gridOptions,
        previousValue: undefined,
        firstChange: true,
        isFirstChange: () => true,
      },
    });
    const merged = component.mergedGridOptions();
    expect(merged.paginationPageSize).toBe(25);
    expect(merged.pagination).toBe(true); // default preserved
  });

  it('should render ag-grid-angular component', () => {
    component.rowData = mockRowData;
    component.columnDefs = mockColumnDefs;
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    const agGrid = compiled.querySelector('ag-grid-angular');
    expect(agGrid).toBeTruthy();
  });

  it('should apply default height', () => {
    expect(component.height).toBe('500px');
  });

  it('should apply default width', () => {
    expect(component.width).toBe('100%');
  });

  it('should accept custom height', () => {
    component.height = '600px';
    expect(component.height).toBe('600px');
  });

  it('should accept custom width', () => {
    component.width = '80%';
    expect(component.width).toBe('80%');
  });

  it('should have grid API available after onGridReady', () => {
    const mockParams = {
      api: {
        sizeColumnsToFit: () => { },
        hideOverlay: () => { },
        getDisplayedRowCount: () => 0,
        setGridOption: () => { },
        refreshCells: () => { },
      },
    } as any;

    component.onGridReady(mockParams);
    expect(component.gridApi).toBeDefined();
  });

  it('should apply theme colors', () => {
    const mockColors = {
      background: '#ffffff',
      foreground: '#000000',
      accent: '#ff0000',
      accentShades: Array(10).fill(['', '#ff0000']),
      accentGradients: {},
      complementary: '#00ff00',
      complementaryShades: Array(10).fill(['', '#00ff00']),
      complementaryGradients: {},
      tertiary: '#0000ff',
      tertiaryShades: Array(10).fill(['', '#0000ff']),
      tertiaryGradients: {},
      success: '#00ff00',
      successShades: Array(10).fill(['', '#00ff00']),
      successGradients: {},
      danger: '#ff0000',
      dangerShades: Array(10).fill(['', '#ff0000']),
      dangerGradients: {},
      warning: '#ffff00',
      warningShades: Array(10).fill(['', '#ffff00']),
      warningGradients: {},
    };

    component.theme = 'light';
    component.applyTheme(mockColors);

    expect(component.background).toBe('#ffffff');
    expect(component.foreground).toBe('#000000');
    expect(component.accent).toBe('#ff0000');
  });

  it('should expose personality id for host binding', () => {
    expect(component.personalityId).toBe('classic');
  });

  it('should set host data-personality attribute', () => {
    fixture.detectChanges();

    const hostElement = fixture.nativeElement as HTMLElement;
    expect(hostElement.getAttribute('data-personality')).toBe(
      component.personalityId
    );
  });
});
