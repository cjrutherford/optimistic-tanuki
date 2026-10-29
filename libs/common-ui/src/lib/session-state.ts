// The pure browser contract avoids evaluating Nest DTO exports in Angular bundles.
// eslint-disable-next-line @nx/enforce-module-boundaries -- shared contract has no package subpath; barrel pulls Node builtins into browsers
import { ACCOUNT_DELETION_BROWSER_BOUNDARY } from '../../../models/src/lib/libs/account-deletion/browser-session-boundary.contract';
/** Small browser-session primitives shared by app auth state services. */
export class SessionGeneration {
  private current = 0;

  next(): number {
    return ++this.current;
  }

  invalidate(): number {
    return this.next();
  }

  isCurrent(generation: number): boolean {
    return generation === this.current;
  }
}

/** Account controls own their errors; a receipt 401 never invalidates a newer login. */
export function isAccountRightsRequest(url: string): boolean {
  return /\/authentication\/account-(?:export|deletion)(?:\/|$)/.test(
    url.split(/[?#]/, 1)[0]
  );
}

/** Remove only keys explicitly owned by the caller; storage failures are contained. */
export function clearOwnedBrowserSessionKeys(
  storage: Pick<Storage, 'removeItem'> | (() => Pick<Storage, 'removeItem'>),
  keys: readonly string[]
): void {
  for (const key of keys) {
    try {
      const target = typeof storage === 'function' ? storage() : storage;
      target.removeItem(key);
    } catch {
      // State cleanup must continue even when browser storage is unavailable.
    }
  }
}

/** Payload-free, same-document invalidation for shared UI caches. */
export function notifyBrowserSessionReset(): void {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new Event('ot:session-reset'));
}

const sessionChannels = new Map<
  string,
  { channel: BroadcastChannel; listeners: number }
>();

/** Same-origin, app-scoped notifications contain no account/profile/token data. */
export function watchBrowserSessionBoundary(
  appId: string,
  clearRemoteState: () => void
): () => void {
  if (
    typeof window === 'undefined' ||
    typeof window.BroadcastChannel !== 'function'
  )
    return () => undefined;
  if (!['client-interface', 'local-hub'].includes(appId))
    throw new Error('INVALID_SESSION_APP');
  let entry = sessionChannels.get(appId);
  if (!entry) {
    try {
      entry = {
        channel: new window.BroadcastChannel(`ot-session-boundary:${appId}`),
        listeners: 0,
      };
      sessionChannels.set(appId, entry);
    } catch {
      return () => undefined;
    }
  }
  const current = entry;
  current.listeners++;
  const handler = (event: MessageEvent) => {
    if (event.data === 'invalidate') clearRemoteState();
  };
  current.channel.addEventListener('message', handler);
  return () => {
    current.channel.removeEventListener('message', handler);
    if (--current.listeners === 0) {
      current.channel.close();
      sessionChannels.delete(appId);
    }
  };
}

export function publishBrowserSessionBoundary(appId: string): void {
  try {
    sessionChannels.get(appId)?.channel.postMessage('invalidate');
  } catch {
    /* Browser policy may disable cross-tab messaging. */
  }
}

/** The server emits this only to a socket authenticated as the deleting account.
 * Compare the current identity again so delayed account-A events cannot clear B. */
export function notifyAccountDeletion(accountId: unknown): void {
  if (
    typeof window !== 'undefined' &&
    typeof accountId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      accountId
    )
  )
    window.dispatchEvent(
      new CustomEvent(
        ACCOUNT_DELETION_BROWSER_BOUNDARY.currentAccountDeletionEvent,
        { detail: accountId.toLowerCase() }
      )
    );
}
export function watchAccountDeletion(
  accountId: () => string | null | undefined,
  clear: () => void
): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const listener = (event: Event) => {
    const current = accountId();
    if (current && (event as CustomEvent).detail === current.toLowerCase())
      clear();
  };
  window.addEventListener(
    ACCOUNT_DELETION_BROWSER_BOUNDARY.currentAccountDeletionEvent,
    listener
  );
  return () =>
    window.removeEventListener(
      ACCOUNT_DELETION_BROWSER_BOUNDARY.currentAccountDeletionEvent,
      listener
    );
}
