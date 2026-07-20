import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Carries the per-request Content-Security-Policy nonce through the async
 * call stack that renders a single SSR request, so that Angular's `CSP_NONCE`
 * DI token (see `app.config.server.ts`) can resolve to the exact same value
 * that `server.ts` sends in the `Content-Security-Policy` response header.
 *
 * A fresh nonce is generated per request in `server.ts` via
 * `crypto.randomBytes`, so a plain module-level variable would be unsafe
 * under concurrent requests; `AsyncLocalStorage` scopes the value correctly
 * even when multiple SSR renders are in flight at once.
 */
export const cspNonceStorage = new AsyncLocalStorage<string>();

/** Reads the current request's CSP nonce, if one is active. */
export function getRequestCspNonce(): string | null {
  return cspNonceStorage.getStore() ?? null;
}
