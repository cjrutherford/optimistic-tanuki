import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GridComponent } from './grid.component';
import { SimpleChanges } from '@angular/core';

describe('GridComponent', () => {
  let component: GridComponent;
  let fixture: ComponentFixture<GridComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GridComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GridComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set renderEmpty to true if columns is 0', () => {
    component.columns = 0;
    component.ngOnInit();
    expect(component.renderEmpty).toBe(true);
  });

  it('should set renderEmpty to true if rows is 0', () => {
    component.rows = 0;
    component.ngOnInit();
    expect(component.renderEmpty).toBe(true);
  });

  it('should set gridTemplateColumns when columns is defined', () => {
    component.columns = 3;
    component.ngOnInit();
    expect(component.gridTemplateColumns).toBe('repeat(3, 1fr)');
  });

  it('should set gridTemplateRows when rows is defined', () => {
    component.rows = 2;
    component.ngOnInit();
    // rowFraction defaults to 'auto', so expect 'repeat(2, auto)'
    expect(component.gridTemplateRows).toBe('repeat(2, auto)');
  });

  it('should update grid dimensions on ngOnChanges when columns or rows change', () => {
    const initialColumns = component.gridTemplateColumns;

    // Trigger ngOnChanges with columns change
    component.columns = 4;
    const changes: SimpleChanges = {
      columns: {
        currentValue: 4,
        previousValue: 'auto-fit',
        firstChange: false,
        isFirstChange: () => false,
      },
    };
    component.ngOnChanges(changes);

    expect(component.gridTemplateColumns).not.toBe(initialColumns);
    expect(component.gridTemplateColumns).toBe('repeat(4, 1fr)');
  });

  it('should use default values when columns and rows are not explicitly set', () => {
    // Test with default values (auto-fit for columns, auto for rows)
    component.ngOnInit();
    // Default values should result in valid grid template strings
    expect(component.gridTemplateColumns).toBeTruthy();
    expect(component.gridTemplateRows).toBeTruthy();
  });

  it('should support auto-fit column configuration', () => {
    component.columns = 'auto-fit';
    component.ngOnInit();
    expect(component.gridTemplateColumns).toContain('auto-fit');
  });

  it('should support auto row configuration', () => {
    component.rows = 'auto';
    component.ngOnInit();
    expect(component.gridTemplateRows).toBe('auto');
  });

  it('should emit gridUpdate event when dimensions change', () => {
    const mockGridUpdate = jest.fn();
    component.gridUpdate.subscribe(mockGridUpdate);

    component.columns = 3;
    component.ngOnInit();

    expect(mockGridUpdate).toHaveBeenCalledWith({
      columns: expect.any(Number),
      rows: expect.any(Number),
    });
  });

  it('should handle flex layout mode', () => {
    component.layout = 'flex';
    component.columns = 3;
    component.ngOnInit();

    expect(component.currentColumns).toBe(3);
  });

  it('should handle horizontal layout mode', () => {
    component.layout = 'horizontal';
    component.rows = 5;
    component.ngOnInit();

    // In horizontal layout, rows should be 1
    expect(component.currentRows).toBe(1);
  });

  it('should handle vertical layout mode', () => {
    component.layout = 'vertical';
    component.columns = 5;
    component.ngOnInit();

    // In vertical layout, columns should be 1
    expect(component.currentColumns).toBe(1);
  });
});
