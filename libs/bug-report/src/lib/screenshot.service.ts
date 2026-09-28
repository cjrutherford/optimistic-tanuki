import { Inject, Injectable, InjectionToken, Optional } from '@angular/core';
import { BUG_REPORT_LIMITS } from './bug-report.models';

export interface ScreenshotRenderer {
  (element: HTMLElement): Promise<{
    toDataURL: (type: string, quality: number) => string;
    width: number;
    height: number;
  }>;
}

export const SCREENSHOT_RENDERER = new InjectionToken<ScreenshotRenderer>(
  'SCREENSHOT_RENDERER'
);

/**
 * Screenshot via html2canvas (lazy import so apps without reports pay nothing).
 * Returns inline `data:image/jpeg;base64,...` ≤ ~2MB chars, downscaling on retry.
 */
@Injectable({ providedIn: 'root' })
export class ScreenshotService {
  private readonly renderer?: ScreenshotRenderer;

  constructor(
    @Optional()
    @Inject(SCREENSHOT_RENDERER)
    renderer?: ScreenshotRenderer | null
  ) {
    this.renderer = renderer ?? undefined;
  }

  async capture(): Promise<string> {
    if (typeof document === 'undefined') return 'data:image/jpeg;base64,';
    const render = this.renderer ?? (await this.loadRenderer());
    const qualities = [0.7, 0.5, 0.3];
    for (const q of qualities) {
      const canvas = await render(document.body as HTMLElement);
      const url = canvas.toDataURL('image/jpeg', q);
      if (url.length <= BUG_REPORT_LIMITS.screenshotDataUrlMax) return url;
    }
    // Last resort: return smallest even if slightly over (backend validates).
    const canvas = await render(document.body as HTMLElement);
    return canvas.toDataURL('image/jpeg', 0.2);
  }

  private async loadRenderer(): Promise<ScreenshotRenderer> {
    const mod = await import('html2canvas');
    const html2canvas = (
      mod as unknown as {
        default: (el: HTMLElement, opts?: object) => Promise<HTMLCanvasElement>;
      }
    ).default;
    return (el: HTMLElement) =>
      html2canvas(el, { logging: false, useCORS: true });
  }
}
