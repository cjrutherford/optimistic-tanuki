import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { normalizeAuthReturnTo } from '@optimistic-tanuki/auth-ui';

const SERVER_ORIGIN = 'http://business-configurator.invalid';

@Injectable({
  providedIn: 'root',
})
export class ReturnIntentService {
  private readonly key = 'hai-system-configurator-return-intent';
  private readonly platformId = inject(PLATFORM_ID);

  remember(url: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const normalized = normalizeAuthReturnTo(url, {
      currentOrigin: this.currentOrigin(),
    });

    if (!normalized?.isCurrentOrigin) {
      this.clear();
      return;
    }

    sessionStorage.setItem(this.key, normalized.path);
  }

  consume(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const value = sessionStorage.getItem(this.key);
    sessionStorage.removeItem(this.key);

    if (!value) {
      return null;
    }

    const normalized = normalizeAuthReturnTo(value, {
      currentOrigin: this.currentOrigin(),
    });
    return normalized?.isCurrentOrigin ? normalized.path : null;
  }

  clear(): void {
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.removeItem(this.key);
    }
  }

  private currentOrigin(): string {
    return typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : SERVER_ORIGIN;
  }
}
