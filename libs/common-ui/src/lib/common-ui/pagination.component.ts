import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { signal, OnInit } from '@angular/core';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-ui';
import { ButtonComponent } from './button/button.component';

@Component({
  selector: 'otui-pagination',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './pagination.component.html',
  styleUrls: ['./pagination.component.scss'],
  host: {
    'class.theme': 'theme',
    '[style.--background]': 'background',
    '[style.--foreground]': 'foreground',
    '[style.--accent]': 'accent',
    '[style.--complement]': 'complement',
    '[style.--border-color]': 'borderColor',
    '[style.--border-gradient]': 'borderGradient',
    '[style.--transition-duration]': 'transitionDuration',
  }
})
export class PaginationComponent extends Themeable implements OnInit {
  override applyTheme(colors: ThemeColors): void {
    this.background = `linear-gradient(to bottom, ${colors.background}, ${colors.accent})`;
    this.foreground = colors.foreground;
    this.accent = colors.accent;
    this.complement = colors.complementary;
    if (this.theme === 'dark') {
      this.borderGradient = colors.complementaryGradients['dark']
      this.borderColor = colors.complementaryShades[6][1];
    } else {
      this.borderGradient = colors.accentGradients['light']
      this.borderColor = colors.complementaryShades[2][1];
    }
    this.transitionDuration = '0.3s';
  }
  @Input() totalPages = 1;
  @Input() currentPage = 1;
  @Input() maxVisiblePages = 5;

  readonly pages = signal<number[]>([]);
  readonly showStartEllipsis = signal<boolean>(false);
  readonly showEndEllipsis = signal<boolean>(false);
  readonly firstPage = signal<number>(1);
  readonly lastPage = signal<number>(this.pages.length);

  override ngOnInit(): void {
    this.updatePageList();  
  }

  updatePageList(): void {

    const half = Math.floor(this.maxVisiblePages / 2);
    let start = Math.max(1, this.currentPage - half);
    let end = Math.min(this.totalPages, this.currentPage + half);

    if (this.currentPage <= half) {
      end = Math.min(this.totalPages, this.maxVisiblePages);
    } else if (this.currentPage + half >= this.totalPages) {
      start = Math.max(1, this.totalPages - this.maxVisiblePages + 1);
    }

    this.showStartEllipsis.set(start > 1);
    this.showEndEllipsis.set(end < this.totalPages);

    const finalPages: number[] = [];
    let actualStart = start;

    if(this.showStartEllipsis()) {
      actualStart++;
    }
    if(!this.showEndEllipsis()) {
      actualStart--;
    }

    for (let i = actualStart; i <= end; i++) {
      finalPages.push(i);
    }

    this.pages.set(finalPages);
  }

  onPageClick(page: number): void {
    this.currentPage = page;
    this.updatePageList();
  }

  onFirstPageClick(): void {
    this.currentPage = 1;
    this.updatePageList();
  }

  onLastPageClick(): void {
    this.currentPage = this.totalPages;
    this.updatePageList();
  }

  onNextPageClick(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePageList();
    }
  }

  onPreviousPageClick(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePageList();
    }
  }
}
