import { createHash } from 'node:crypto';

/**
 * Version tokens for review items. A token is an opaque digest of the state a reviewer saw (status, latest
 * decision, decision count, and for an identity the assertion digest). A decision carries the token it was made
 * against; under the item's row locks the store recomputes it and refuses a mismatch with `stale_decision`.
 */
export const VERSION_TOKEN = /^[0-9a-f]{64}$/;

export const STALE_DECISION = 'stale_decision';
export const NOT_LATEST = 'not_latest';
export const IDEMPOTENCY_CONFLICT = 'decision_conflict';

/** A decision that cannot be applied because the item moved on. Routes map these to HTTP 409. */
export class ReviewConflictError extends Error {
  constructor(
    readonly code:
      | typeof STALE_DECISION
      | typeof NOT_LATEST
      | typeof IDEMPOTENCY_CONFLICT
      | 'invalid_state',
    message?: string
  ) {
    super(message ?? code);
    this.name = 'ReviewConflictError';
  }
}

export function versionToken(parts: readonly unknown[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

export function assertFreshToken(expected: unknown, actual: string): void {
  if (typeof expected !== 'string' || !VERSION_TOKEN.test(expected))
    throw Error('Invalid version token');
  if (expected !== actual) throw new ReviewConflictError(STALE_DECISION);
}
