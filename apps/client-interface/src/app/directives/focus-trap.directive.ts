import { Directive, ElementRef, OnInit, OnDestroy } from '@angular/core';

@Directive({
  selector: '[appFocusTrap]',
  standalone: true,
})
export class FocusTrapDirective implements OnInit, OnDestroy {
  private focusableElements: string =
    'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  private firstFocusable: HTMLElement | null = null;
  private lastFocusable: HTMLElement | null = null;
  private boundHandleKeydown: (event: KeyboardEvent) => void;

  constructor(private el: ElementRef) {
    this.boundHandleKeydown = this.handleKeydown.bind(this);
  }

  ngOnInit() {
    this.el.nativeElement.addEventListener('keydown', this.boundHandleKeydown);
    setTimeout(() => this.setInitialFocus(), 0);
  }

  ngOnDestroy() {
    this.el.nativeElement.removeEventListener(
      'keydown',
      this.boundHandleKeydown
    );
  }

  private setInitialFocus() {
    const focusable = this.el.nativeElement.querySelectorAll(
      this.focusableElements
    );
    if (focusable.length > 0) {
      this.firstFocusable = focusable[0];
      this.lastFocusable = focusable[focusable.length - 1];
      this.firstFocusable?.focus();
    }
  }

  private handleKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;

    if (!this.firstFocusable || !this.lastFocusable) return;

    if (event.shiftKey) {
      if (document.activeElement === this.firstFocusable) {
        event.preventDefault();
        this.lastFocusable?.focus();
      }
    } else {
      if (document.activeElement === this.lastFocusable) {
        event.preventDefault();
        this.firstFocusable?.focus();
      }
    }
  }
}
