import { isPlatformBrowser } from '@angular/common';

/**
 * True when motion should be skipped: on the server, or when the visitor
 * asks for reduced motion.
 */
export function prefersReducedMotion(platformId: object): boolean {
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  if (typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
