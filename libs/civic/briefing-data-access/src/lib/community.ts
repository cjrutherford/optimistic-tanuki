import type { ContributionViewState } from '../generated/civic';

/**
 * Wording and small helpers the generated client doesn't provide. The
 * routes themselves are in `../generated/civic.ts`.
 */

/** Attachments are served as downloads, so pages link to them rather than fetch them. */
export function artifactUrl(sha256: string): string {
  return `/api/local-hub/artifacts/${encodeURIComponent(sha256)}`;
}

/**
 * The target band from the corroboration plan: enough people that
 * independent accounts are ordinary. Matches civic-community's.
 */
export const DENSITY_TARGET = { low: 8, high: 12 } as const;

/**
 * A key for one submission attempt; resending the same form reuses it.
 * `randomUUID` exists only in secure contexts (HTTPS or localhost), so a
 * site served over plain HTTP builds a version 4 UUID from
 * `getRandomValues`, which every context has.
 */
export function submissionKey(): string {
  if (typeof globalThis.crypto.randomUUID === 'function')
    return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4),
    hex.slice(4, 6),
    hex.slice(6, 8),
    hex.slice(8, 10),
    hex.slice(10, 16),
  ]
    .map((part) => part.join(''))
    .join('-');
}

/** A contribution's state in the contributor's terms. */
export const STATE_WORDS: Record<
  ContributionViewState,
  { label: string; meaning: string }
> = {
  accepted: {
    label: 'Recorded',
    meaning:
      'Nothing in it needs to wait. It is kept, ready to be corroborated later in the beta.',
  },
  held: {
    label: 'Waiting for evidence',
    meaning:
      'It is kept, and waits until a document or an independent account supports it.',
  },
  rejected: {
    label: 'Not accepted',
    meaning: 'It was not taken in; the reason says what to change.',
  },
  withdrawn: { label: 'Withdrawn', meaning: 'You withdrew it.' },
  'taken-down': {
    label: 'Taken down',
    meaning:
      'It was removed on a copyright notice. You may answer with a counter-notice.',
  },
};

export const STAGE_WORDS: Record<string, string> = {
  upload: 'Attachment',
  duplication: 'Copying check',
  model: 'Review',
  withdrawal: 'Withdrawal',
  takedown: 'Copyright notice',
  restoration: 'Restored',
  corroboration: 'Corroboration',
  briefing: 'In a briefing',
};
