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

  it('should calculate total pages correctly', () => {
    component.totalItems = 100;
    component.itemsPerPage = 10;
    component.currentPage = 1;
    component.ngOnInit();
    fixture.detectChanges();

    expect(component.totalPagesCount).toBe(10);
  });

  it('should emit page change event on page click', () => {
    const pageChangeSpy = jest.spyOn(component.pageChange, 'emit');
    component.totalItems = 100;
    component.itemsPerPage = 10;
    component.currentPage = 1;
    component.ngOnInit();
    fixture.detectChanges();

    component.onPageClick(5);
    expect(pageChangeSpy).toHaveBeenCalledWith(5);
    expect(component.currentPage).toBe(5);
  });

  it('should handle previous page click', () => {
    component.totalItems = 100;
    component.itemsPerPage = 10;
    component.currentPage = 5;
    component.ngOnInit();
    fixture.detectChanges();

    component.onPreviousPageClick();
    expect(component.currentPage).toBe(4);
  });

  it('should handle next page click', () => {
    component.totalItems = 100;
    component.itemsPerPage = 10;
    component.currentPage = 5;
    component.ngOnInit();
    fixture.detectChanges();

    component.onNextPageClick();
    expect(component.currentPage).toBe(6);
  });

  it('should not go below page 1 on previous', () => {
    component.totalItems = 100;
    component.itemsPerPage = 10;
    component.currentPage = 1;
    component.ngOnInit();
    fixture.detectChanges();

    component.onPreviousPageClick();
    expect(component.currentPage).toBe(1);
  });

  it('should not exceed total pages on next', () => {
    component.totalItems = 50;
    component.itemsPerPage = 10;
    component.currentPage = 5;
    component.ngOnInit();
    fixture.detectChanges();

    component.onNextPageClick();
    expect(component.currentPage).toBe(5);
  });

  it('should handle first page click', () => {
    const pageChangeSpy = jest.spyOn(component.pageChange, 'emit');
    component.totalItems = 100;
    component.itemsPerPage = 10;
    component.currentPage = 5;
    component.ngOnInit();
    fixture.detectChanges();

    component.onFirstPageClick();
    expect(component.currentPage).toBe(1);
    expect(pageChangeSpy).toHaveBeenCalledWith(1);
  });

  it('should handle last page click', () => {
    const pageChangeSpy = jest.spyOn(component.pageChange, 'emit');
    component.totalItems = 100;
    component.itemsPerPage = 10;
    component.currentPage = 1;
    component.ngOnInit();
    fixture.detectChanges();

    component.onLastPageClick();
    expect(component.currentPage).toBe(10);
    expect(pageChangeSpy).toHaveBeenCalledWith(10);
  });

  it('should handle keyboard navigation', () => {
    component.totalItems = 100;
    component.itemsPerPage = 10;
    component.currentPage = 5;
    component.ngOnInit();
    fixture.detectChanges();

    const prevEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
    component.onPaginationKeydown(prevEvent);
    expect(component.currentPage).toBe(4);

    const nextEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    component.onPaginationKeydown(nextEvent);
    expect(component.currentPage).toBe(5);
  });

  it('should handle home key', () => {
    component.totalItems = 100;
    component.itemsPerPage = 10;
    component.currentPage = 5;
    component.ngOnInit();
    fixture.detectChanges();

    const homeEvent = new KeyboardEvent('keydown', { key: 'Home' });
    component.onPaginationKeydown(homeEvent);
    expect(component.currentPage).toBe(1);
  });

  it('should handle end key', () => {
    component.totalItems = 100;
    component.itemsPerPage = 10;
    component.currentPage = 5;
    component.ngOnInit();
    fixture.detectChanges();

    const endEvent = new KeyboardEvent('keydown', { key: 'End' });
    component.onPaginationKeydown(endEvent);
    expect(component.currentPage).toBe(10);
  });
});
