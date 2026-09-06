import { PresenceGap } from '@optimistic-tanuki/models/leads-contracts';

/**
 * Turning an observed presence gap into the first line of a message.
 *
 * A gap's label is written for a chip — "No website listed" — and reads as a
 * verdict pinned to a business rather than something a person would say. The
 * opening line is the one sentence most likely to be read, so it has to be a
 * sentence.
 *
 * Every phrasing is built from the words of the gap's own label plus ordinary
 * connectives. That is not a stylistic preference: the anti-fabrication guard
 * checks this line like any other, and the label is the part that is provably
 * true of this business. A nicer sentence built from words nobody observed
 * would be removed before the user ever saw it — correctly.
 */

type GapOpener = (business: string, label: string) => string;

const OPENERS: Record<string, GapOpener> = {
  'no-website': (business) => `${business} doesn't have a website listed.`,
  'no-reviews': (business) => `${business} has no reviews at all.`,
  'few-reviews': (business, label) =>
    `${business} has ${label.replace(/^Only /, 'only ')}.`,
  'low-rating': (business, label) =>
    `${business} has a ${label.replace(/^Rating /, 'rating ')}.`,
  'no-hours': (business) => `${business} doesn't have opening hours published.`,
  'no-phone': (business) => `${business} has no phone number listed.`,
};

/**
 * The gap worth opening on: the heaviest one, since that is the same ranking
 * the leads list sorts by and the one the user already saw at the top.
 */
export const selectLeadingGap = (
  gaps: PresenceGap[] | null | undefined
): PresenceGap | null => {
  const ranked = [...(gaps || [])].sort((a, b) => b.weight - a.weight);
  return ranked[0] || null;
};

/**
 * The opening sentence for a gap, or the label as a plain statement when the
 * gap code has no phrasing of its own — a new gap should read awkwardly rather
 * than silently vanish from the message.
 */
export const describeGapAsOpening = (
  gap: PresenceGap,
  business: string
): string => {
  const opener = OPENERS[gap.code];
  return opener
    ? opener(business, gap.label)
    : `${business}: ${gap.label.toLowerCase()}.`;
};
