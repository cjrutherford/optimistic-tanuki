import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

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

    localStorage.setItem(this.key, url);
  }

  consume(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const value = localStorage.getItem(this.key);
    if (value) {
      localStorage.removeItem(this.key);
    }
    return value;
  }
}
