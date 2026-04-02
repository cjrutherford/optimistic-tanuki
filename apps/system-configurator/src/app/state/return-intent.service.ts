import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ReturnIntentService {
  private readonly key = 'hai-system-configurator-return-intent';

  remember(url: string): void {
    localStorage.setItem(this.key, url);
  }

  consume(): string | null {
    const value = localStorage.getItem(this.key);
    if (value) {
      localStorage.removeItem(this.key);
    }
    return value;
  }
}
