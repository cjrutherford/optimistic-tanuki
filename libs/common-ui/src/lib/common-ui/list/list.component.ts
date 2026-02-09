import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';
import { ListItem } from '../interfaces/component.interface';
import { Variantable } from '../interfaces/variantable.interface';

/**
 * Standardized List Component
 *
 * Accessible list component with keyboard navigation, proper ARIA, and theme support.
 *
 * @example
 * ```html
 * <otui-list
 *   [items]="listItems"
 *   [type]="'bullet'"
 *   [variant]="'glass'"
 *   [clickable]="true"
 *   (itemSelect)="onItemClick($event)"
 * ></otui-list>
 * ```
 */
@Component({
  selector: 'otui-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.theme]': 'theme',
  },
})
export class ListComponent extends Variantable {
  // ==================== INPUTS ====================

  /** List items */
  @Input() items: ListItem[] = [];

  /** List type: bullet, numbered, dash, icon */
  @Input() type: 'bullet' | 'numbered' | 'dash' | 'icon' | 'none' = 'bullet';

  /** Layout direction: vertical or horizontal */
  @Input() layout: 'vertical' | 'horizontal' = 'vertical';

  /** Show dividers between items */
  @Input() dividers = false;

  /** Items are hoverable */
  @Input() hoverable = true;

  /** Visual variant */
  @Input() variant: 'default' | 'glass' | 'gradient' = 'default';

  /** Component size */
  @Input() size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md';

  /** Whether items are clickable */
  @Input() clickable = false;

  /** Accessibility label for the list container */
  @Input() ariaLabel?: string;

  /** Accessibility labelledby for the list container */
  @Input() ariaLabelledBy?: string;

  /** Accessibility describedby for the list container */
  @Input() ariaDescribedBy?: string;

  // ==================== OUTPUTS ====================

  /** Item selection event */
  @Output() itemSelect = new EventEmitter<{
    item: ListItem;
    index: number;
  }>();

  // ==================== STATE ====================

  private clickEnabled = true;

  // ==================== GETTERS ====================

  /**
   * Get count of selected items for screen reader announcements
   */
  get selectedCount(): number {
    return this.items.filter((item) => item.selected).length;
  }

  // ==================== LIFECYCLE ====================

  override ngOnInit(): void {
    super.ngOnInit?.();
  }

  // ==================== PUBLIC METHODS ====================

  /**
   * Handle item click
   */
  onItemClick(item: ListItem, index: number): void {
    if (!this.clickEnabled || item.disabled) return;

    this.itemSelect.emit({ item, index });
  }

  /**
   * Track function for ngFor
   */
  trackByIndex(index: number, item: ListItem): string | number {
    return item.id || index;
  }

  // ==================== KEYBOARD NAVIGATION ====================

  /**
   * Handle keyboard navigation
   */
  onKeydown(event: KeyboardEvent, item: ListItem, index: number): void {
    if (!this.clickEnabled) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.focusNextItem(index);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.focusPreviousItem(index);
        break;
      case 'Enter':
      case ' ':
        if (!item.disabled) {
          event.preventDefault();
          this.onItemClick(item, index);
        }
        break;
      case 'Home':
        event.preventDefault();
        this.focusFirstItem();
        break;
      case 'End':
        event.preventDefault();
        this.focusLastItem();
        break;
    }
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Focus next item
   */
  private focusNextItem(currentIndex: number): void {
    const nextIndex = Math.min(currentIndex + 1, this.items.length - 1);
    this.focusItem(nextIndex);
  }

  /**
   * Focus previous item
   */
  private focusPreviousItem(currentIndex: number): void {
    const prevIndex = Math.max(currentIndex - 1, 0);
    this.focusItem(prevIndex);
  }

  /**
   * Focus first item
   */
  private focusFirstItem(): void {
    this.focusItem(0);
  }

  /**
   * Focus last item
   */
  private focusLastItem(): void {
    this.focusItem(this.items.length - 1);
  }

  /**
   * Focus specific item
   */
  private focusItem(index: number): void {
    const itemSelector = `[role="listitem"]:not([disabled]):nth-child(${
      index + 1
    })`;
    const element = document.querySelector(itemSelector) as HTMLElement;
    if (element) {
      element.focus();
    }
  }

  // ==================== THEME IMPLEMENTATION ====================

  applyVariant(colors: ThemeColors, options?: any): void {
    // Set list-specific CSS variables
    const complementColor = colors.complementary || '#919ee4';
    const accentColor = colors.accent || '#b1baec';

    this.setLocalCSSVariables({
      'list-divider': this.dividers ? `1px solid ${complementColor}` : 'none',
      'list-hover-bg': this.hoverable
        ? `rgba(${this.hexToRgb(accentColor)}, 0.1)`
        : 'transparent',
    });

    // Parent applyVariant handles basic theming automatically
  }

  /**
   * Convert hex to RGB for rgba values
   */
  private hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return '0, 0, 0';

    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `${r}, ${g}, ${b}`;
  }
}
