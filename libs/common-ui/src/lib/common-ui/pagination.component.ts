import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  HostListener,
  ChangeDetectionStrategy,
  ElementRef,
} from '@angular/core';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';
import { ButtonComponent } from './button/button.component';
import { Variantable } from './interfaces/variantable.interface';

/**
 * Standardized Pagination Component
 *
 * Accessible pagination with keyboard navigation, internationalization, and theme support.
 *
 * @example
 * ```html
 * <otui-pagination
 *   [totalItems]="100"
 *   [itemsPerPage]="10"
 *   [currentPage]="currentPage"
 *   [ariaLabel]="'Page navigation'"
 *   (pageChange)="onPageChange($event)"
 * ></otui-pagination>
 * ```
 */
@Component({
  selector: 'otui-pagination',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './pagination.component.html',
  styleUrls: ['./pagination.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.theme]': 'theme',
  },
})
export class PaginationComponent extends Variantable implements OnInit {
  constructor() {
    super();
  }

  @Input() totalItems = 0;
  @Input() itemsPerPage = 10;
  @Input() currentPage = 1;
  @Input() maxVisiblePages = 5;
  @Input() showStartEllipsisInput = true;
  @Input() showEndEllipsisInput = true;
  @Input() showFirstLast = true;

  /** Total pages getter for screen readers */
  @Input() disabled = false;
  @Input() style: 'default' | 'outlined' | 'filled' = 'default';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() ariaLabel?: string;
  @Input() ariaLabelledBy?: string;
  @Input() ariaDescribedBy?: string;

  @Output() pageChange = new EventEmitter<number>();

  private totalPages = 1;
  private _pages: number[] = [];
  private _showStartEllipsis = false;
  private _showEndEllipsis = false;

  override ngOnInit(): void {
    super.ngOnInit();
    this.calculateTotalPages();
    this.updatePageList();
  }

  // Public getters for template access
  get totalPagesCount(): number {
    return this.totalPages;
  }

  get showStartEllipsis(): boolean {
    return this._showStartEllipsis;
  }

  get showEndEllipsis(): boolean {
    return this._showEndEllipsis;
  }

  get pages(): number[] {
    return this._pages;
  }

  private calculateTotalPages(): void {
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
  }

  private updatePageList(): void {
    const half = Math.floor(this.maxVisiblePages / 2);
    let start = Math.max(1, this.currentPage - half);
    let end = Math.min(this.totalPages, this.currentPage + half);

    if (this.currentPage <= half) {
      end = Math.min(this.totalPages, this.maxVisiblePages);
    } else if (this.currentPage + half >= this.totalPages) {
      start = Math.max(1, this.totalPages - this.maxVisiblePages + 1);
    }

    this._showStartEllipsis = start > 1;
    this._showEndEllipsis = end < this.totalPages;

    this._pages = [];
    let actualStart = start;
    if (this._showStartEllipsis) {
      actualStart++;
    }

    if (!this._showEndEllipsis) {
      actualStart--;
    }

    for (let i = actualStart; i <= end; i++) {
      this._pages.push(i);
    }
  }

  onPageClick(page: number): void {
    this.currentPage = page;
    this.updatePageList();
    this.pageChange.emit(page);
  }

  onFirstPageClick(): void {
    this.currentPage = 1;
    this.updatePageList();
    this.pageChange.emit(1);
  }

  onLastPageClick(): void {
    this.currentPage = this.totalPages;
    this.updatePageList();
    this.pageChange.emit(this.totalPages);
  }

  onNextPageClick(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePageList();
      this.pageChange.emit(this.currentPage);
    }
  }

  onPreviousPageClick(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePageList();
      this.pageChange.emit(this.currentPage);
    }
  }

  // ==================== KEYBOARD NAVIGATION ====================

  @HostListener('keydown.arrowleft', ['$event'])
  onPreviousKey(event: Event): void {
    (event as KeyboardEvent).preventDefault();
    this.onPreviousPageClick();
  }

  @HostListener('keydown.arrowright', ['$event'])
  onNextKey(event: Event): void {
    (event as KeyboardEvent).preventDefault();
    this.onNextPageClick();
  }

  @HostListener('keydown.home', ['$event'])
  onHomeKey(event: Event): void {
    (event as KeyboardEvent).preventDefault();
    this.onFirstPageClick();
  }

  @HostListener('keydown.end', ['$event'])
  onEndKey(event: Event): void {
    (event as KeyboardEvent).preventDefault();
    this.onLastPageClick();
  }

  /**
   * Handle keyboard navigation for pagination buttons
   */
  onPaginationKeydown(event: KeyboardEvent): void {
    if (this.disabled) return;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        this.onPreviousPageClick();
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.onNextPageClick();
        break;
      case 'Home':
        event.preventDefault();
        this.onFirstPageClick();
        break;
      case 'End':
        event.preventDefault();
        this.onLastPageClick();
        break;
      case 'PageUp':
        event.preventDefault();
        this.onPreviousPageClick();
        break;
      case 'PageDown':
        event.preventDefault();
        this.onNextPageClick();
        break;
    }
  }

  applyVariant(colors: any): void {
    // Implementation for abstract method
    // Apply theme colors using CSS custom properties
    if (this.elementRef?.nativeElement) {
      const element = this.elementRef.nativeElement;
      Object.keys(colors).forEach((key) => {
        element.style.setProperty(`--pagination-${key}`, colors[key]);
      });
    }
  }
}
