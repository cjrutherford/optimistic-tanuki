import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  HostListener,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';
import { AccordionSection } from '../interfaces/component.interface';
import { Variantable } from '../interfaces/variantable.interface';
import type { Emphasis, Tone } from '../interfaces/variant.contract';

/** @deprecated Use `tone` + `emphasis` (+ decorative `surface`). */
export type AccordionVariant = 'default' | 'glass' | 'gradient';

/** Decorative surface chrome, folded out of the legacy variant. */
export type AccordionSurface = 'flat' | 'glass' | 'gradient';

/** Accordion emphasis: the shared contract plus a `flat` (no-fill) default. */
export type AccordionEmphasis = Emphasis | 'flat';

const ACCORDION_VARIANT_BRIDGE: Record<
  AccordionVariant,
  { emphasis: AccordionEmphasis; surface: AccordionSurface }
> = {
  default: { emphasis: 'flat', surface: 'flat' },
  glass: { emphasis: 'soft', surface: 'glass' },
  gradient: { emphasis: 'soft', surface: 'gradient' },
};

/**
 * Standardized Accordion Component
 *
 * Accessible accordion with keyboard navigation, proper ARIA, and theme support.
 *
 * @example
 * ```html
 * <otui-accordion
 *   [sections]="accordionData"
 *   [variant]="'glass'"
 *   [multiple]="true"
 *   (sectionToggle)="onToggle($event)"
 * >
 * </otui-accordion>
 * ```
 */
@Component({
  selector: 'otui-accordion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './accordion.component.html',
  styleUrls: ['./accordion.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.theme]': 'theme',
  },
})
export class AccordionComponent
  extends Variantable
  implements OnInit, OnDestroy
{
  // ==================== INPUTS ====================

  /** Accordion sections data */
  @Input() sections: AccordionSection[] = [];

  /** Allow multiple sections to be open simultaneously */
  @Input() multiple = false;

  /** Canonical semantic tone. */
  @Input() tone: Tone = 'neutral';
  /** Canonical visual treatment (`flat` = the borderless default). */
  @Input() emphasis: AccordionEmphasis = 'flat';
  /** Decorative surface chrome, folded out of the legacy `variant`. */
  @Input() surface: AccordionSurface = 'flat';

  /**
   * Legacy visual variant. Folds onto the canonical `emphasis` axis plus the
   * decorative `surface` flag via {@link ACCORDION_VARIANT_BRIDGE}.
   *
   * @deprecated Use `tone` + `emphasis` (+ `surface`) instead.
   */
  @Input() set variant(value: AccordionVariant) {
    this._variant = value;
    const binding = ACCORDION_VARIANT_BRIDGE[value];
    if (binding) {
      this.emphasis = binding.emphasis;
      this.surface = binding.surface;
    }
  }
  get variant(): AccordionVariant {
    return this._variant;
  }
  private _variant: AccordionVariant = 'default';

  /** Component size */
  @Input() size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md';

  /** Accessibility label for the accordion container */
  @Input() ariaLabel?: string;

  // ==================== OUTPUTS ====================

  /** Section toggle event */
  @Output() sectionToggle = new EventEmitter<{
    index: number;
    section: AccordionSection;
    isOpen: boolean;
  }>();

  // ==================== STATE ====================

  /** Currently expanded section indices */
  private expandedIndices: number[] = [];

  // ==================== LIFECYCLE ====================

  override ngOnInit(): void {
    super.ngOnInit?.();
    // Initialize with first section open if not multiple mode
    if (!this.multiple && this.sections.length > 0) {
      this.expandedIndices = [0];
    }
  }

  // ==================== PUBLIC METHODS ====================

  /**
   * Toggle section expansion
   */
  toggleSection(index: number): void {
    const section = this.sections[index];
    if (!section || section.disabled) return;

    const isCurrentlyOpen = this.expandedIndices.includes(index);

    if (this.multiple) {
      // Multiple sections can be open
      if (isCurrentlyOpen) {
        this.expandedIndices = this.expandedIndices.filter((i) => i !== index);
      } else {
        this.expandedIndices = [...this.expandedIndices, index];
      }
    } else {
      // Single section mode
      this.expandedIndices = isCurrentlyOpen ? [] : [index];
    }

    this.emitSectionToggle(index, section, !isCurrentlyOpen);
  }

  /**
   * Track function for ngFor
   */
  trackByIndex(index: number, section: AccordionSection): string | number {
    return section.id || index;
  }

  /**
   * Get expanded state for a section
   */
  isSectionExpanded(index: number): boolean {
    return this.expandedIndices.includes(index);
  }

  // ==================== ACCESSIBILITY ====================

  /**
   * Get ARIA attributes for a section header
   */
  getSectionAria(index: number): {
    role: string;
    ariaExpanded: boolean;
    ariaControls: string;
    tabIndex: number;
    ariaLabel?: string;
  } {
    return {
      role: 'button',
      ariaExpanded: this.isSectionExpanded(index),
      ariaControls: `accordion-section-${index}`,
      tabIndex: 0,
      ariaLabel: this.ariaLabel,
    };
  }

  /**
   * Get ARIA attributes for the accordion container
   */
  getContainerAria(): {
    role: string;
    ariaLabel?: string;
    ariaMultiSelectable: boolean;
  } {
    return {
      role: 'region',
      ariaLabel: this.ariaLabel,
      ariaMultiSelectable: this.multiple,
    };
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Emit section toggle event
   */
  private emitSectionToggle(
    index: number,
    section: AccordionSection,
    isOpen: boolean
  ): void {
    this.sectionToggle.emit({
      index,
      section,
      isOpen,
    });
  }

  /**
   * Handle nested accordion toggle
   */
  onNestedToggle(event: any): void {
    // Re-emit nested events to parent level
    this.sectionToggle.emit(event);
  }

  // ==================== KEYBOARD NAVIGATION ====================

  @HostListener('keydown.arrowdown', ['$event'])
  onArrowDown(event: Event): void {
    if (this.multiple || this.expandedIndices.length === 0) return;

    const currentFocus = document.activeElement;
    if (!currentFocus) return;

    const allHeaders = Array.from(
      document.querySelectorAll(
        '[role="button"][aria-controls^="accordion-section"]'
      )
    );
    const currentIndex = allHeaders.indexOf(currentFocus as Element);
    const nextIndex = Math.min(currentIndex + 1, allHeaders.length - 1);

    (allHeaders[nextIndex] as HTMLElement).focus();
    event.preventDefault();
  }

  @HostListener('keydown.arrowup', ['$event'])
  onArrowUp(event: Event): void {
    if (this.multiple || this.expandedIndices.length === 0) return;

    const currentFocus = document.activeElement;
    if (!currentFocus) return;

    const allHeaders = Array.from(
      document.querySelectorAll(
        '[role="button"][aria-controls^="accordion-section"]'
      )
    );
    const currentIndex = allHeaders.indexOf(currentFocus as Element);
    const prevIndex = Math.max(currentIndex - 1, 0);

    (allHeaders[prevIndex] as HTMLElement).focus();
    event.preventDefault();
  }

  @HostListener('keydown.home', ['$event'])
  onHome(event: Event): void {
    if (this.multiple || this.expandedIndices.length === 0) return;

    const firstHeader = document.querySelector(
      '[role="button"][aria-controls^="accordion-section"]'
    ) as HTMLElement;

    if (firstHeader) {
      firstHeader.focus();
      event.preventDefault();
    }
  }

  @HostListener('keydown.end', ['$event'])
  onEnd(event: Event): void {
    if (this.multiple || this.expandedIndices.length === 0) return;

    const allHeaders = Array.from(
      document.querySelectorAll(
        '[role="button"][aria-controls^="accordion-section"]'
      )
    );
    const lastHeader = allHeaders[allHeaders.length - 1] as HTMLElement;

    if (lastHeader) {
      lastHeader.focus();
      event.preventDefault();
    }
  }

  // ==================== THEME IMPLEMENTATION ====================

  override applyVariant(_colors: ThemeColors, _options?: any): void {
    // Surface + emphasis are now rendered from the shared variant contract and
    // personality/theme CSS variables in SCSS; no per-instance hardcoded
    // colors are needed here.
  }
}
