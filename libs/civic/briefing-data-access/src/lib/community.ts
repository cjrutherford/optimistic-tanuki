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

/** A key for one submission attempt; resending the same form reuses it. */
export function submissionKey(): string {
  return globalThis.crypto.randomUUID();
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
