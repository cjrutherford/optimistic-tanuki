import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** What Chromium fires when it decides an app is installable. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const REFUSED_KEY = 'learning.install.refused';

/**
 * Holds the browser's install offer until somebody asks for it.
 *
 * The event fires once, early, and is lost if nothing captures it, which is
 * why this exists at all rather than living in a component. A refusal is
 * remembered, because asking twice is how a prompt becomes a nuisance.
 */
@Injectable({ providedIn: 'root' })
export class InstallService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private deferred: InstallPromptEvent | null = null;

  /** True only when the browser has offered and the person has not refused. */
  readonly available = signal(false);

  constructor() {
    if (!this.isBrowser) return;
    if (localStorage.getItem(REFUSED_KEY) === 'true') return;
    window.addEventListener('beforeinstallprompt', (event) => {
      // Without this the browser shows its own banner on its own schedule.
      event.preventDefault();
      this.deferred = event as InstallPromptEvent;
      this.available.set(true);
    });
    window.addEventListener('appinstalled', () => {
      this.deferred = null;
      this.available.set(false);
    });
  }

  async install(): Promise<void> {
    const event = this.deferred;
    if (!event) return;
    // The offer is single-use: once prompted, the event is spent whatever the
    // person chooses.
    this.deferred = null;
    this.available.set(false);
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === 'dismissed') this.remember();
  }

  dismiss(): void {
    this.deferred = null;
    this.available.set(false);
    this.remember();
  }

  private remember(): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(REFUSED_KEY, 'true');
    } catch {
      // Private browsing refuses to store this. Being asked again next time
      // is a smaller problem than failing here.
    }
  }
}
