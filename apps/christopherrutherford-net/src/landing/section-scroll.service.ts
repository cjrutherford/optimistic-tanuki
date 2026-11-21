import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

/**
 * Scrolls a landing section into view. The page scrolls inside `body`, not
 * the window, so window-based scrolling (Router anchor scrolling,
 * ViewportScroller) does nothing here; `scrollIntoView` works for any scroll
 * container and honours the target's `scroll-margin-top`.
 */
@Injectable({ providedIn: 'root' })
export class SectionScrollService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Scrolls to the element with `id` and moves focus to it. */
  scrollTo(id: string): boolean {
    if (!this.isBrowser || !id) return false;
    const target = this.document.getElementById(id);
    if (!target) return false;

    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({
      block: 'start',
      behavior: reduceMotion ? 'instant' : 'smooth',
    });

    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
    }
    target.focus({ preventScroll: true });
    return true;
  }
}
