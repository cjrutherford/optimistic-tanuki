import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  TableComponent,
  TableRowAction,
  TableAction,
  TableRow,
} from './table.component';

describe('TableComponent', () => {
  let component: TableComponent;
  let fixture: ComponentFixture<TableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TableComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should convert legacy badge cells to columns', () => {
    component.cells = [{ heading: 'Test', isBadge: true }];
    fixture.detectChanges();
    // The cells setter should convert legacy cells to columns
    expect(component.columns.length).toBeGreaterThan(0);
  });

  it('should track spacer input as deprecated property', () => {
    // Spacer is now deprecated and just stores the value
    component.spacer = true;
    expect(component.spacer).toBe(true);
    component.spacer = false;
    expect(component.spacer).toBe(false);
  });

  it('should return true for hasOverflowableCells if any cell is overflowable', () => {
    component.cells = [{ isOverflowable: true }];
    expect(component.hasOverflowableCells).toBe(true);
  });

  it('should return false for hasOverflowableCells if no cell is overflowable', () => {
    component.cells = [{ isOverflowable: false }];
    expect(component.hasOverflowableCells).toBe(false);
  });

  it('should toggle rowExpanded', () => {
    expect(component.rowExpanded).toBe(false);
    component.toggleRowExpansion();
    expect(component.rowExpanded).toBe(true);
    component.toggleRowExpansion();
    expect(component.rowExpanded).toBe(false);
  });

  it('should return false if value is not TemplateRef', () => {
    expect(component.isTemplateRef('string')).toBe(false);
  });

  it('should toggle showActions', () => {
    expect(component.showActions).toBe(false);
    component.toggleActions();
    expect(component.showActions).toBe(true);
    component.toggleActions();
    expect(component.showActions).toBe(false);
  });

  it('should execute legacy action and hide actions', () => {
    const mockAction = jest.fn();
    const action: TableRowAction = { title: 'Test', action: mockAction };
    component.rowIndex = 5;
    component.executeLegacyAction(action);
    expect(mockAction).toHaveBeenCalledWith(5);
    expect(component.showActions).toBe(false);
  });

  it('should execute new action with row and index', () => {
    const mockActionFn = jest.fn();
    const action: TableAction = {
      label: 'Test',
      action: mockActionFn,
    };
    const row: TableRow = { id: 1, name: 'Test' };
    component.executeAction(action, row, 3);
    expect(mockActionFn).toHaveBeenCalledWith(row, 3);
  });

  it('should support columns and data inputs', () => {
    component.columns = [
      { key: 'id', header: 'ID' },
      { key: 'name', header: 'Name' },
    ];
    component.data = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
    ];
    fixture.detectChanges();

    expect(component.columns.length).toBe(2);
    expect(component.data.length).toBe(2);
  });

  it('should track selection state using toggleRowSelection', () => {
    const row1: TableRow = { id: 1 };
    const row2: TableRow = { id: 2 };
    component.data = [row1, row2];
    component.selectable = true;

    expect(component.isRowSelected(row1)).toBe(false);

    // Use toggleRowSelection instead of handleRowClick
    component.toggleRowSelection(row1);
    expect(component.isRowSelected(row1)).toBe(true);
    expect(component.isRowSelected(row2)).toBe(false);

    // Toggle again should deselect
    component.toggleRowSelection(row1);
    expect(component.isRowSelected(row1)).toBe(false);
  });

  it('should support row selection toggling', () => {
    const row1: TableRow = { id: 1 };
    component.data = [row1];
    component.selectable = true;

    component.toggleRowSelection(row1);
    expect(component.selectedRows.has(row1)).toBe(true);

    component.toggleRowSelection(row1);
    expect(component.selectedRows.has(row1)).toBe(false);
  });

  it('should support toggling all selections', () => {
    const row1: TableRow = { id: 1 };
    const row2: TableRow = { id: 2 };
    component.data = [row1, row2];
    component.selectable = true;

    // Select all
    component.toggleAllSelection();
    expect(component.areAllSelected()).toBe(true);
    expect(component.isRowSelected(row1)).toBe(true);
    expect(component.isRowSelected(row2)).toBe(true);

    // Deselect all
    component.toggleAllSelection();
    expect(component.areAllSelected()).toBe(false);
    expect(component.isRowSelected(row1)).toBe(false);
    expect(component.isRowSelected(row2)).toBe(false);
  });

  it('should handle row click events', () => {
    const mockRowClick = jest.fn();
    component.rowClick.subscribe(mockRowClick);

    const row: TableRow = { id: 1, name: 'Test' };
    component.handleRowClick(row, 0);

    expect(mockRowClick).toHaveBeenCalledWith({ row, index: 0 });
  });

  it('should handle sort events', () => {
    const mockSort = jest.fn();
    component.sort.subscribe(mockSort);

    component.columns = [{ key: 'name', header: 'Name', sortable: true }];
    component.sortable = true;
    fixture.detectChanges();

    component.handleSort(component.columns[0]);
    expect(mockSort).toHaveBeenCalledWith({ column: 'name', direction: 'asc' });

    // Sort again should toggle direction
    component.handleSort(component.columns[0]);
    expect(mockSort).toHaveBeenCalledWith({
      column: 'name',
      direction: 'desc',
    });
  });

  it('should get sort indicator', () => {
    component.columns = [{ key: 'name', header: 'Name', sortable: true }];
    component.sortable = true;

    // No sort applied yet
    expect(component.getSortIndicator(component.columns[0])).toBe('↕️');

    // Sort ascending
    component.handleSort(component.columns[0]);
    expect(component.getSortIndicator(component.columns[0])).toBe('↑');

    // Sort descending
    component.handleSort(component.columns[0]);
    expect(component.getSortIndicator(component.columns[0])).toBe('↓');
  });

  it('should emit rowSelect event when selection changes', () => {
    const mockRowSelect = jest.fn();
    component.rowSelect.subscribe(mockRowSelect);

    const row1: TableRow = { id: 1 };
    component.data = [row1];
    component.selectable = true;

    component.toggleRowSelection(row1);
    expect(mockRowSelect).toHaveBeenCalledWith([row1]);
  });

  it('should respect selectable flag', () => {
    const row1: TableRow = { id: 1 };
    component.data = [row1];
    component.selectable = false; // Not selectable

    component.toggleRowSelection(row1);
    // Should not be selected because selectable is false
    expect(component.isRowSelected(row1)).toBe(false);

    // Enable selection
    component.selectable = true;
    component.toggleRowSelection(row1);
    expect(component.isRowSelected(row1)).toBe(true);
  });
});
