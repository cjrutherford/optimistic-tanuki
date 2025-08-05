import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TableCell, TableComponent, TableRowAction } from './table.component';

import { TemplateRef } from '@angular/core';
import { ThemeService } from '@optimistic-tanuki/theme-ui';

describe('TableComponent', () => {
  let component: TableComponent;
  let fixture: ComponentFixture<TableComponent>;
  let themeService: ThemeService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TableComponent],
      providers: [ThemeService]
    }).compileComponents();

    fixture = TestBed.createComponent(TableComponent);
    component = fixture.componentInstance;
    themeService = TestBed.inject(ThemeService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should apply dark theme colors when theme is dark', () => {
    const mockColors = {
      background: '#000',
      foreground: '#fff',
      accent: '#111',
      complementary: '#222',
      accentShades: [[null, '#666'], [null, '#777'], [null, '#888'], [null, '#999'], [null, '#aaa'], [null, '#bbb'], [null, '#ccc']],
      complementaryShades: [[null, '#ddd'], [null, '#eee'], [null, '#fff']],
      accentGradients: { dark: 'dark-accent-gradient', light: 'light-accent-gradient' },
    } as any;

    component.theme = 'dark';
    component.applyTheme(mockColors);

    expect(component.background).toBe(mockColors.background);
    expect(component.backgroundGradient).toBe(`linear-gradient(to bottom, ${mockColors.accent}, ${mockColors.background}, ${mockColors.background}, ${mockColors.accentShades[1][1]})`);
    expect(component.foreground).toBe(mockColors.foreground);
    expect(component.accent).toBe(mockColors.accent);
    expect(component.complement).toBe(mockColors.complementary);
    expect(component.borderGradient).toBe(mockColors.accentGradients.dark);
    expect(component.borderColor).toBe(mockColors.complementaryShades[2][1]);
  });

  it('should apply light theme colors when theme is light', () => {
    const mockColors = {
      background: '#eee',
      foreground: '#222',
      accent: '#abc',
      complementary: '#def',
      accentShades: [[null, '#666'], [null, '#777'], [null, '#888'], [null, '#999'], [null, '#aaa'], [null, '#bbb'], [null, '#ccc']],
      complementaryShades: [[null, '#ddd'], [null, '#eee'], [null, '#fff']],
      accentGradients: { dark: 'dark-accent-gradient', light: 'light-accent-gradient' },
    } as any;

    component.theme = 'light';
    component.applyTheme(mockColors);

    expect(component.background).toBe(mockColors.background);
    expect(component.backgroundGradient).toBe(`linear-gradient(to bottom, ${mockColors.accent}, ${mockColors.background}, ${mockColors.background}, ${mockColors.accentShades[1][1]})`);
    expect(component.foreground).toBe(mockColors.foreground);
    expect(component.accent).toBe(mockColors.accent);
    expect(component.complement).toBe(mockColors.complementary);
    expect(component.borderGradient).toBe(mockColors.accentGradients.light);
    expect(component.borderColor).toBe(mockColors.complementaryShades[2][1]);
  });

  it('should initialize table with badge cells', () => {
    component.cells = [{ heading: 'Test', isBadge: true }];
    (component as any).initializeTable();
    expect(component.cells[0].heading).toBeUndefined();
  });

  // it('should initialize table with template ref cells', () => {
  //   const mockTemplateRef = {} as TemplateRef<HTMLElement>;
  //   component.cells = [{ value: mockTemplateRef }];
  //   (component as any).initializeTable();
  //   expect(component.cellTemplates[0]).toBe(mockTemplateRef);
  // });

  it('should add spacer cell if spacer is true', () => {
    component.spacer = true;
    component.cells = [];
    (component as any).initializeTable();
    expect(component.cells.length).toBe(1);
    expect(component.cells[0].customStyles).toEqual({ flex: '1' });
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

  // it('should return true if value is TemplateRef', () => {
  //   const mockTemplateRef = {} as TemplateRef<HTMLElement>;
  //   expect(component.isTemplateRef(mockTemplateRef)).toBe(true);
  // });

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

  it('should execute action and hide actions', () => {
    const mockAction = jest.fn();
    const action: TableRowAction = { title: 'Test', action: mockAction };
    component.rowIndex = 5;
    component.executeAction(action);
    expect(mockAction).toHaveBeenCalledWith(5);
    expect(component.showActions).toBe(false);
  });
});
