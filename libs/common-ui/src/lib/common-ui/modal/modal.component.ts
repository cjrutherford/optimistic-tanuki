import {
  Component,
  EventEmitter,
  Input,
  Output,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  Renderer2,
  HostListener,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';
import { ButtonComponent } from '../button/button.component';

/**
 * Modal size options
 */
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

/**
 * Modal position options
 */
export type ModalPosition =
  | 'center'
  | 'top'
  | 'sidebar-left'
  | 'sidebar-right'
  | 'bottom';

/**
 * Standardized Modal Component
 *
 * Fully accessible modal with focus trap, keyboard navigation, and theme support.
 *
 * @example
 * ```html
 * <otui-modal
 *   [visible]="showModal"
 *   [size]="'lg'"
 *   [position]="'center'"
 *   [closable]="true"
 *   [backdrop]="true"
 *   [ariaLabel]="'User Details'"
 *   (close)="showModal = false"
 * >
 *   <h2 modal-title>User Details</h2>
 *   <p>Modal content here...</p>
 * </otui-modal>
 * ```
 */
@Component({
  selector: 'otui-modal',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.scss'],
  host: {
    '[class.theme]': 'theme',
    '[class.variant]': 'variant',
    '[class.size-sm]': 'size === "sm"',
    '[class.size-md]': 'size === "md"',
    '[class.size-lg]': 'size === "lg"',
    '[class.size-xl]': 'size === "xl"',
    '[class.size-full]': 'size === "full"',
    '[class.position-center]': 'position === "center"',
    '[class.position-top]': 'position === "top"',
    '[class.position-sidebar-left]': 'position === "sidebar-left"',
    '[class.position-sidebar-right]': 'position === "sidebar-right"',
    '[class.position-bottom]': 'position === "bottom"',
    '[style.--local-background]': 'background',
    '[style.--local-foreground]': 'foreground',
    '[style.--local-accent]': 'accent',
    '[style.--local-complement]': 'complement',
    '[style.--local-border-color]': 'borderColor',
    '[style.--local-border-gradient]': 'borderGradient',
    '[style.--local-transition-duration]': 'transitionDuration',
  },
})
export class ModalComponent
  extends Themeable
  implements AfterViewInit, OnDestroy
{
  private renderer = inject(Renderer2);

  // ==================== NEW STANDARD INPUTS ====================

  /** Controls modal visibility */
  @Input() visible = false;

  /** Modal heading/title */
  @Input() heading = '';

  /** Modal size */
  @Input() size: ModalSize = 'md';

  /** Modal position */
  @Input() position: ModalPosition = 'center';

  /** Visual variant */
  @Input() variant: 'default' | 'glass' | 'gradient' | 'bordered' = 'default';

  /** Show close button */
  @Input() closable = true;

  /** Show backdrop overlay */
  @Input() backdrop = true;

  /** Close on backdrop click */
  @Input() closeOnBackdrop = true;

  /** Close on Escape key */
  @Input() closeOnEscape = true;

  /** Trap focus within modal */
  @Input() focusTrap = true;

  /** Lock body scroll when modal is open */
  @Input() lockScroll = true;

  /** ARIA label for the dialog */
  @Input() ariaLabel?: string;

  /** ARIA labelledby reference (ID of title element) */
  @Input() ariaLabelledBy?: string;

  /** ARIA describedby reference */
  @Input() ariaDescribedBy?: string;

  /** Custom z-index */
  @Input() zIndex?: number;

  // ==================== OUTPUTS ====================

  /** Emitted when modal is closed */
  @Output() close = new EventEmitter<void>();

  /** Emitted when modal is opened */
  @Output() open = new EventEmitter<void>();

  /** Emitted when backdrop is clicked */
  @Output() backdropClick = new EventEmitter<void>();

  // ==================== DEPRECATED INPUTS (Backward Compatibility) ====================

  /**
   * @deprecated Use 'position' input instead. Will be removed in v2.0.
   */
  @Input() set mode(
    value:
      | 'sidebar'
      | 'sidebar-left'
      | 'trough'
      | 'standard-modal'
      | 'captive-modal'
  ) {
    console.warn(
      `[otui-modal] Warning: "mode" input is deprecated. Use "position" and "size" inputs instead. Will be removed in v2.0.`
    );
    this._legacyMode = value;
    this._convertLegacyMode(value);
  }
  get mode() {
    return this._legacyMode;
  }
  _legacyMode:
    | 'sidebar'
    | 'sidebar-left'
    | 'trough'
    | 'standard-modal'
    | 'captive-modal' = 'standard-modal';

  /**
   * @deprecated Use 'close' output instead. Will be removed in v2.0.
   * This is kept for backward compatibility but will be removed.
   */
  @Output() closeModal = new EventEmitter<void>();

  // ==================== INTERNAL ====================

  @ViewChild('modalDialog', { static: false })
  modalDialog!: ElementRef<HTMLDivElement>;
  @ViewChild('closeButton', { static: false })
  closeButton!: ElementRef<HTMLButtonElement>;

  private focusableElements: HTMLElement[] = [];
  private previouslyFocusedElement: HTMLElement | null = null;
  private bodyScrollLock = false;

  // ==================== LIFECYCLE ====================

  ngAfterViewInit(): void {
    if (this.visible) {
      this.onModalOpen();
    }
  }

  override ngOnDestroy(): void {
    this.unlockBodyScroll();
  }

  // ==================== THEME ====================

  override applyTheme(colors: ThemeColors): void {
    this.background = colors.background;
    this.foreground = colors.foreground;
    this.accent = colors.accent;
    this.complement = colors.complementary;
    this.borderColor = colors.complementary;
    this.borderGradient = colors.complementaryGradients['light'];
    this.transitionDuration = '0.3s';
  }

  // ==================== VISIBILITY HANDLING ====================

  /**
   * Open the modal
   */
  show(): void {
    if (!this.visible) {
      this.visible = true;
      this.open.emit();
      setTimeout(() => this.onModalOpen(), 0);
    }
  }

  /**
   * Close the modal
   */
  hide(): void {
    if (this.visible) {
      this.visible = false;
      this.close.emit();
      this.onModalClose();
    }
  }

  // ==================== EVENT HANDLERS ====================

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (this.visible && this.closeOnEscape) {
      (event as KeyboardEvent).preventDefault();
      this.hide();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    // Only close if clicking the backdrop itself, not the modal content
    if (event.target === event.currentTarget && this.closeOnBackdrop) {
      this.backdropClick.emit();
      this.hide();
    }
  }

  onCloseClick(): void {
    this.hide();
  }

  // ==================== FOCUS TRAP ====================

  private onModalOpen(): void {
    if (!this.visible) return;

    // Store previously focused element
    this.previouslyFocusedElement = document.activeElement as HTMLElement;

    // Lock body scroll
    if (this.lockScroll) {
      this.lockBodyScroll();
    }

    // Collect focusable elements
    if (this.focusTrap) {
      this.collectFocusableElements();
      // Focus first element or close button
      setTimeout(() => {
        if (this.closeButton?.nativeElement) {
          this.closeButton.nativeElement.focus();
        } else {
          this.focusFirstElement();
        }
      }, 100);
    }
  }

  private onModalClose(): void {
    // Restore focus
    if (this.previouslyFocusedElement) {
      this.previouslyFocusedElement.focus();
    }

    // Unlock body scroll
    this.unlockBodyScroll();
  }

  private collectFocusableElements(): void {
    if (!this.modalDialog?.nativeElement) return;

    const selector = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    this.focusableElements = Array.from(
      this.modalDialog.nativeElement.querySelectorAll(selector)
    ) as HTMLElement[];
  }

  @HostListener('keydown.tab', ['$event'])
  onTabKey(event: Event): void {
    if (!this.focusTrap || !this.visible || this.focusableElements.length === 0)
      return;

    const firstElement = this.focusableElements[0];
    const lastElement =
      this.focusableElements[this.focusableElements.length - 1];
    const activeElement = document.activeElement as HTMLElement;
    const keyboardEvent = event as KeyboardEvent;

    if (keyboardEvent.shiftKey) {
      // Shift + Tab - move backward
      if (
        activeElement === firstElement ||
        !this.focusableElements.includes(activeElement)
      ) {
        keyboardEvent.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab - move forward
      if (activeElement === lastElement) {
        keyboardEvent.preventDefault();
        firstElement.focus();
      }
    }
  }

  private focusFirstElement(): void {
    if (this.focusableElements.length > 0) {
      this.focusableElements[0].focus();
    }
  }

  // ==================== BODY SCROLL LOCK ====================

  private lockBodyScroll(): void {
    if (this.bodyScrollLock) return;

    const scrollY = window.scrollY;
    this.renderer.setStyle(document.body, 'position', 'fixed');
    this.renderer.setStyle(document.body, 'top', `-${scrollY}px`);
    this.renderer.setStyle(document.body, 'left', '0');
    this.renderer.setStyle(document.body, 'right', '0');
    this.renderer.setStyle(document.body, 'overflow', 'hidden');
    this.bodyScrollLock = true;
  }

  private unlockBodyScroll(): void {
    if (!this.bodyScrollLock) return;

    const scrollY = document.body.style.top;
    this.renderer.removeStyle(document.body, 'position');
    this.renderer.removeStyle(document.body, 'top');
    this.renderer.removeStyle(document.body, 'left');
    this.renderer.removeStyle(document.body, 'right');
    this.renderer.removeStyle(document.body, 'overflow');
    window.scrollTo(0, parseInt(scrollY || '0') * -1);
    this.bodyScrollLock = false;
  }

  // ==================== LEGACY CONVERSION ====================

  private _convertLegacyMode(mode: string): void {
    switch (mode) {
      case 'sidebar':
      case 'sidebar-right':
        this.position = 'sidebar-right';
        break;
      case 'sidebar-left':
        this.position = 'sidebar-left';
        break;
      case 'trough':
        this.position = 'bottom';
        break;
      case 'captive-modal':
        this.position = 'center';
        this.size = 'full';
        break;
      case 'standard-modal':
      default:
        this.position = 'center';
        break;
    }
  }
}
