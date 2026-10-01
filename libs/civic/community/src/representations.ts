/**
 * What a contributor represents when they submit, per the corroboration
 * plan's terms: that they witnessed what they describe, that the words are
 * their own, and that they may share what they attach. Each must be affirmed
 * explicitly, every time; nothing is assumed from an earlier submission.
 */

export interface Representations {
  /** For an account: I saw or heard this myself. */
  witnessed?: boolean;
  /** The text is mine, apart from any quotation I have marked and attributed. */
  ownWords?: boolean;
  /** I have the right to share what I attach. */
  rightsToAttachments?: boolean;
}

export function missingRepresentations(
  kind: 'account' | 'artifact',
  given: Representations,
  hasAttachment: boolean
): string[] {
  const missing: string[] = [];
  if (kind === 'account' && given.witnessed !== true)
    missing.push('Confirm that you saw or heard this yourself.');
  if (given.ownWords !== true)
    missing.push(
      'Confirm that the words are your own, apart from any quotation you have attributed.'
    );
  if (hasAttachment && given.rightsToAttachments !== true)
    missing.push('Confirm that you have the right to share what you attached.');
  return missing;
}
