import { Directive, ElementRef, Input, OnInit, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appLazyLoad]',
  standalone: true,
})
export class LazyLoadDirective implements OnInit {
  @Input('appLazyLoad') imageSrc!: string;
  @Input() placeholder = '';

  constructor(
    private el: ElementRef,
    private renderer: Renderer2
  ) {}

  ngOnInit() {
    // Set placeholder if provided
    if (this.placeholder) {
      this.renderer.setAttribute(this.el.nativeElement, 'src', this.placeholder);
    }

    // Set loading attribute for native lazy loading
    this.renderer.setAttribute(this.el.nativeElement, 'loading', 'lazy');

    // Check if browser supports native lazy loading
    if ('loading' in HTMLImageElement.prototype) {
      // Browser supports native lazy loading
      this.renderer.setAttribute(this.el.nativeElement, 'src', this.imageSrc);
    } else {
      // Fallback to IntersectionObserver for older browsers
      this.useLazyLoadFallback();
    }
  }

  private useLazyLoadFallback() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          this.renderer.setAttribute(this.el.nativeElement, 'src', this.imageSrc);
          observer.disconnect();
        }
      });
    });

    observer.observe(this.el.nativeElement);
  }
}
