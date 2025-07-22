import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaginationComponent } from './pagination.component';

describe('PaginationComponent', () => {
  let component: PaginationComponent;
  let fixture: ComponentFixture<PaginationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaginationComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PaginationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set complement style variable based on theme colors', () => {
    const mockColors = {
      background: '#fff',
      accent: '#f00',
      foreground: '#000',
      complementary: '#0f0',
      complementaryGradients: { dark: 'linear-gradient(#0f0, #000)' },
      accentGradients: { light: 'linear-gradient(#f00, #fff)' },
      complementaryShades: [[null, '#0f0'], [null, '#0f0'], [null, '#0f0'], [null, '#0f0'], [null, '#0f0'], [null, '#0f0'], [null, '#0f0']],
    } as any;

    component.theme = 'light';
    component.applyTheme(mockColors);

    expect(component.complement).toBe('#0f0');
  });

  it('should initialize with default pages', () => {
    component.totalPages = 10;
    component.currentPage = 1;
    component.maxVisiblePages = 5;
    component.ngOnInit();
    expect(component.pages()).toEqual([1,2,3,4,5]);
    expect(component.showStartEllipsis()).toBe(false);
    expect(component.showEndEllipsis()).toBe(true);
  });

  // it('should update pages when currentPage changes', () => {
  //   component.totalPages = 10;
  //   component.maxVisiblePages = 5;
  //   component.currentPage = 6;
  //   component.updatePageList();
  //   expect(component.pages()).toEqual([4,5,6,7,8]);
  //   expect(component.showStartEllipsis()).toBe(true);
  //   expect(component.showEndEllipsis()).toBe(true);
  // });

  it('should show ellipsis correctly at the start and end', () => {
    component.totalPages = 10;
    component.maxVisiblePages = 5;
    component.currentPage = 10;
    component.updatePageList();
    expect(component.pages()).toEqual([6,7,8,9,10]);
    expect(component.showStartEllipsis()).toBe(true);
    expect(component.showEndEllipsis()).toBe(false);
  });

  it('should handle onPageClick', () => {
    component.totalPages = 10;
    component.maxVisiblePages = 5;
    component.onPageClick(7);
    expect(component.currentPage).toBe(7);
    expect(component.pages()).toContain(7);
  });

  it('should handle onFirstPageClick', () => {
    component.totalPages = 10;
    component.maxVisiblePages = 5;
    component.currentPage = 5;
    component.onFirstPageClick();
    expect(component.currentPage).toBe(1);
    expect(component.pages()).toEqual([1,2,3,4,5]);
  });

  it('should handle onLastPageClick', () => {
    component.totalPages = 10;
    component.maxVisiblePages = 5;
    component.currentPage = 1;
    component.onLastPageClick();
    expect(component.currentPage).toBe(10);
    expect(component.pages()).toEqual([6,7,8,9,10]);
  });

  it('should handle onNextPageClick', () => {
    component.totalPages = 10;
    component.maxVisiblePages = 5;
    component.currentPage = 5;
    component.onNextPageClick();
    expect(component.currentPage).toBe(6);
    expect(component.pages()).toContain(6);
  });

  it('should not increment currentPage past totalPages in onNextPageClick', () => {
    component.totalPages = 10;
    component.maxVisiblePages = 5;
    component.currentPage = 10;
    component.onNextPageClick();
    expect(component.currentPage).toBe(10);
  });

  it('should handle onPreviousPageClick', () => {
    component.totalPages = 10;
    component.maxVisiblePages = 5;
    component.currentPage = 5;
    component.onPreviousPageClick();
    expect(component.currentPage).toBe(4);
    expect(component.pages()).toContain(4);
  });

  it('should not decrement currentPage below 1 in onPreviousPageClick', () => {
    component.totalPages = 10;
    component.maxVisiblePages = 5;
    component.currentPage = 1;
    component.onPreviousPageClick();
    expect(component.currentPage).toBe(1);
  });
});
