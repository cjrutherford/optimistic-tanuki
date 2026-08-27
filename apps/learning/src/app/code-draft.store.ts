import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const PREFIX = 'learning:challenge-code:';

/**
 * Keeps a learner's in-progress code for each exercise.
 *
 * Drafts are per-browser rather than per-account on purpose: they are the
 * unfinished attempt, not the recorded answer. A passing submit is what gets
 * persisted server-side.
 */
@Injectable({ providedIn: 'root' })
export class CodeDraftStore {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** The saved draft, or null when there is none or storage is unavailable. */
  read(exerciseId: string): string | null {
    if (!this.isBrowser) return null;
    try {
      return globalThis.localStorage?.getItem(PREFIX + exerciseId) ?? null;
    } catch {
      // Private browsing and blocked storage both throw. A missing draft is
      // not worth breaking the lesson over.
      return null;
    }
  }

  write(exerciseId: string, code: string): void {
    if (!this.isBrowser) return;
    try {
      globalThis.localStorage?.setItem(PREFIX + exerciseId, code);
    } catch {
      /* storage full or blocked; the lesson still works */
    }
  }

  clear(exerciseId: string): void {
    if (!this.isBrowser) return;
    try {
      globalThis.localStorage?.removeItem(PREFIX + exerciseId);
    } catch {
      /* nothing to do */
    }
  }
}
