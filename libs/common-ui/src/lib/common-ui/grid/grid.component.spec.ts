import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GridComponent } from './grid.component';
import { SimpleChange, SimpleChanges } from '@angular/core';

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
    expect(component.gridTemplateRows).toBe('repeat(2, 1fr)');
  });

  it('should call setGridDimensions on ngOnChanges', () => {
    const setGridDimensionsSpy = jest.spyOn(component as any, 'setGridDimensions');
    component.ngOnChanges({} as SimpleChanges);
    expect(setGridDimensionsSpy).toHaveBeenCalled();
  });

  it('should not set gridTemplateColumns or gridTemplateRows if columns and rows are undefined', () => {
    component.columns = undefined;
    component.rows = undefined;
    component.ngOnInit();
    expect(component.gridTemplateColumns).toBe('');
    expect(component.gridTemplateRows).toBe('');
  });
});
