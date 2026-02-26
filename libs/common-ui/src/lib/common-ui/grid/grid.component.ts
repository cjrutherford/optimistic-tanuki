import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  HostBinding,
  ElementRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Variantable } from '../interfaces/variantable.interface';

/**
 * Unified Grid Component
 *
 * Combines Grid and GridLayout functionality into a single, powerful component.
 * Supports both grid and flexible layout patterns with full responsive control.
 *
 * @example
 * ```html
 * <otui-grid [columns]="3" [rows]="auto" gap="md"></otui-grid>
 * <otui-grid [columns]="auto-fit" [minColumnWidth]="200px"></otui-grid>
 * <otui-grid layout="horizontal" gap="lg"></otui-grid>
 * ```
 */
@Component({
  selector: 'otui-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './grid.component.html',
  styleUrls: ['./grid.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridComponent extends Variantable implements OnInit, OnChanges {
  override elementRef = inject(ElementRef);
  // Core Grid Configuration
  @Input() columns: number | 'auto-fit' = 'auto-fit';
  @Input() rows: number | 'auto' = 'auto';
  @Input() gap: string | number = 'md';
  @Input() minColumnWidth = '200px';
  @Input() maxColumnWidth = '1fr';

  // Layout Options
  @Input() layout: 'grid' | 'flex' | 'horizontal' | 'vertical' = 'grid';
  @Input() direction: 'row' | 'column' = 'row';
  @Input() wrap = true;
  @Input() justifyContent:
    | 'start'
    | 'center'
    | 'end'
    | 'between'
    | 'around'
    | 'evenly' = 'start';
  @Input() alignItems: 'start' | 'center' | 'end' | 'stretch' = 'stretch';
  @Input() alignContent: 'start' | 'center' | 'end' | 'stretch' = 'stretch';

  // Events
  @Output() gridUpdate = new EventEmitter<{ columns: number; rows: number }>();

  // Host bindings
  @HostBinding('class.otui-grid') hostClass = true;
  @HostBinding('class.otui-grid-flex') get isFlexLayout() {
    return this.layout === 'flex';
  }
  @HostBinding('class.otui-grid-horizontal') get isHorizontal() {
    return this.layout === 'horizontal';
  }
  @HostBinding('class.otui-grid-vertical') get isVertical() {
    return this.layout === 'vertical';
  }

  // Internal state
  currentColumns = 1;
  currentRows = 1;
  renderEmpty = false;

  // Computed styles
  gridTemplateColumns = '';
  gridTemplateRows = '';
  columnFraction = '1fr';
  rowFraction = 'auto';

  override ngOnInit(): void {
    this.updateGridDimensions();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['columns'] || changes['rows'] || changes['layout']) {
      this.updateGridDimensions();
    }
  }

  private updateGridDimensions(): void {
    this.setGridDimensions();
    this.gridUpdate.emit({
      columns: this.currentColumns,
      rows: this.currentRows,
    });
  }

  private setGridDimensions(): void {
    this.renderEmpty = false;

    if (this.columns === 0 || this.rows === 0) {
      this.renderEmpty = true;
      return;
    }

    if (
      this.layout === 'flex' ||
      this.layout === 'horizontal' ||
      this.layout === 'vertical'
    ) {
      this.setFlexDimensions();
    } else {
      this.setGridLayout();
    }
  }

  private setFlexDimensions(): void {
    // Flex layout logic
    this.currentColumns =
      this.layout === 'vertical'
        ? 1
        : typeof this.columns === 'number'
        ? this.columns
        : 1;
    this.currentRows =
      this.layout === 'horizontal'
        ? 1
        : typeof this.rows === 'number'
        ? this.rows
        : 1;
  }

  private setGridLayout(): void {
    if (typeof this.columns === 'number') {
      this.gridTemplateColumns = `repeat(${this.columns}, ${this.columnFraction})`;
      this.currentColumns = this.columns;
    } else {
      // Auto-fit handling
      this.gridTemplateColumns = `repeat(auto-fit, minmax(${this.minColumnWidth}, ${this.maxColumnWidth}))`;
      this.currentColumns = 1; // Will be determined by browser
    }

    if (typeof this.rows === 'number') {
      this.gridTemplateRows = `repeat(${this.rows}, ${this.rowFraction})`;
      this.currentRows = this.rows;
    } else {
      this.gridTemplateRows = 'auto';
      this.currentRows = 1;
    }
  }

  // Gap handling
  getGapValue(): string {
    if (typeof this.gap === 'number') {
      return `${this.gap}px`;
    }

    const gapMap: { [key: string]: string } = {
      none: '0',
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
      '2xl': '48px',
      '3xl': '64px',
    };

    return gapMap[this.gap] || this.gap;
  }

  // Justify content mapping
  getJustifyContentValue(): string {
    const justifyMap: { [key: string]: string } = {
      start: 'flex-start',
      center: 'center',
      end: 'flex-end',
      between: 'space-between',
      around: 'space-around',
      evenly: 'space-evenly',
    };

    return justifyMap[this.justifyContent] || 'flex-start';
  }

  // Theme system integration
  applyVariant(colors: any): void {
    // Implementation for theme variant application
    this.setCSSProperties(colors);
  }

  private setCSSProperties(colors: any): void {
    // Set CSS custom properties for theming
    if (this.elementRef?.nativeElement) {
      const element = this.elementRef.nativeElement;
      Object.keys(colors).forEach((key) => {
        element.style.setProperty(`--grid-${key}`, colors[key]);
      });
    }
  }
}
