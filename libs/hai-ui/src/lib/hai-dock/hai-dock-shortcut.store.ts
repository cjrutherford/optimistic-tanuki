import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/** Where the dock keeps the HAI apps a visitor pinned. */
export const HAI_DOCK_SHORTCUTS_STORAGE_KEY = 'hai-dock-shortcuts:v1';

/**
 * Persistence for the dock's pinned app shortcuts, as an ordered list of app
 * ids (`HaiRegistryApp.appId`). The dock only talks to this contract, so a
 * profile-backed implementation can replace the device-local one by providing
 * `{ provide: HaiDockShortcutStore, useClass: ... }` — nothing else changes.
 *
 * The store does not validate ids against the app directory: the dock ignores
 * ids it cannot resolve, and keeping them means an app that is briefly
 * missing from the registry is not silently unpinned.
 */
@Injectable({
  providedIn: 'root',
  useFactory: () => inject(LocalStorageHaiDockShortcutStore),
})
export abstract class HaiDockShortcutStore {
  /** The pinned app ids right now. */
  abstract get(): string[];
  /** Replaces the pinned app ids. */
  abstract set(appIds: string[]): void;
  /** Emits the current ids on subscription, then on every change. */
  abstract observe(): Observable<string[]>;
}

/**
 * Keeps the pins in this browser's `localStorage`. Safe under SSR: it never
 * touches `window` or `localStorage` off the browser (or when storage is
 * blocked), where it behaves as an in-memory store that starts empty.
 */
@Injectable({ providedIn: 'root' })
export class LocalStorageHaiDockShortcutStore extends HaiDockShortcutStore {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly ids$ = new BehaviorSubject<string[]>([]);
  private loaded = false;

  override get(): string[] {
    this.load();
    return this.ids$.value;
  }

  override set(appIds: string[]): void {
    this.loaded = true;
    const ids = sanitise(appIds);
    this.ids$.next(ids);
    this.write(ids);
  }

  override observe(): Observable<string[]> {
    this.load();
    return this.ids$.asObservable();
  }

  /** Reads storage once, on first use in the browser, and follows other tabs. */
  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    if (!this.isBrowser) return;
    this.ids$.next(this.read());
    window.addEventListener('storage', (event) => {
      if (event.key === HAI_DOCK_SHORTCUTS_STORAGE_KEY) {
        this.ids$.next(this.read());
      }
    });
  }

  private read(): string[] {
    try {
      const raw = localStorage.getItem(HAI_DOCK_SHORTCUTS_STORAGE_KEY);
      return raw ? sanitise(JSON.parse(raw)) : [];
    } catch {
      // Blocked storage or a corrupt value: start from nothing.
      return [];
    }
  }

  private write(ids: string[]): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(HAI_DOCK_SHORTCUTS_STORAGE_KEY, JSON.stringify(ids));
    } catch {
      // Quota or blocked storage: the pins last for this session only.
    }
  }
}

/** Keeps non-empty strings, once each, in order. Anything else is dropped. */
function sanitise(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (id): id is string => typeof id === 'string' && id.length > 0
      )
    ),
  ];
}
