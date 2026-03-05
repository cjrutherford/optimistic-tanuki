import {
  Directive,
  ElementRef,
  Output,
  EventEmitter,
  Input,
  OnDestroy,
} from '@angular/core';

@Directive({
  selector: '[appKeyboardNav]',
  standalone: true,
})
export class KeyboardNavDirective implements OnDestroy {
  @Input() navigationAxis: 'horizontal' | 'vertical' = 'vertical';
  @Input() itemSelector = '[role="option"], [tabindex], .keyboard-navigable';
  @Output() selected = new EventEmitter<number>();

  private items: HTMLElement[] = [];
  private currentIndex = -1;
  private boundHandleKeydown: (event: KeyboardEvent) => void;

  constructor(private el: ElementRef) {
    this.boundHandleKeydown = this.handleKeydown.bind(this);
  }

  ngOnInit() {
    this.el.nativeElement.addEventListener('keydown', this.boundHandleKeydown);
  }

  ngOnDestroy() {
    this.el.nativeElement.removeEventListener(
      'keydown',
      this.boundHandleKeydown
    );
  }

  private handleKeydown(event: KeyboardEvent) {
    this.items = Array.from(
      this.el.nativeElement.querySelectorAll(this.itemSelector)
    );

    if (this.items.length === 0) return;

    const isVertical = this.navigationAxis === 'vertical';

    switch (event.key) {
      case 'ArrowDown':
        if (!isVertical) return;
        event.preventDefault();
        this.navigate(1);
        break;
      case 'ArrowUp':
        if (!isVertical) return;
        event.preventDefault();
        this.navigate(-1);
        break;
      case 'ArrowRight':
        if (isVertical) return;
        event.preventDefault();
        this.navigate(1);
        break;
      case 'ArrowLeft':
        if (isVertical) return;
        event.preventDefault();
        this.navigate(-1);
        break;
      case 'Home':
        event.preventDefault();
        this.navigateTo(0);
        break;
      case 'End':
        event.preventDefault();
        this.navigateTo(this.items.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (this.currentIndex >= 0) {
          this.selected.emit(this.currentIndex);
          this.items[this.currentIndex]?.click();
        }
        break;
    }
  }

  private navigate(direction: number) {
    if (this.items.length === 0) return;

    this.currentIndex =
      (this.currentIndex + direction + this.items.length) % this.items.length;
    this.focusCurrent();
  }

  private navigateTo(index: number) {
    if (index < 0 || index >= this.items.length) return;
    this.currentIndex = index;
    this.focusCurrent();
  }

  private focusCurrent() {
    this.items.forEach((item, i) => {
      item.setAttribute('tabindex', i === this.currentIndex ? '0' : '-1');
    });
    this.items[this.currentIndex]?.focus();
  }
}
