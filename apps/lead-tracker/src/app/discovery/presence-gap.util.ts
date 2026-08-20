/**
 * Shared definition of a "presence gap".
 *
 * Both local-business sources — Google Places and OSM Overpass — exist to find
 * businesses whose online presence has something missing worth pitching to.
 * The scoring lives here so the two cannot drift into disagreeing about what
 * counts as a gap or what it is worth.
 */

/** A specific, nameable shortfall in a business's online presence. */
export type PresenceGap = { code: string; label: string; weight: number };

/**
 * Source-agnostic view of a business. Each provider maps its own payload into
 * this shape; `undefined` means "the source does not report this", which is
 * treated as unknown rather than missing.
 */
export type BusinessPresence = {
  website?: string | null;
  phone?: string | null;
  hasOpeningHours?: boolean;
  rating?: number | null;
  reviewCount?: number | null;
};

/**
 * A field counts as a confirmed gap only when the source actually reported on
 * it and reported nothing. `undefined` means the source never covered the
 * field, which is not evidence of anything.
 */
const isConfirmedlyAbsent = (value: string | null | undefined): boolean =>
  value !== undefined && !value;

export const findPresenceGaps = (presence: BusinessPresence): PresenceGap[] => {
  const gaps: PresenceGap[] = [];

  if (isConfirmedlyAbsent(presence.website)) {
    gaps.push({ code: 'no-website', label: 'No website listed', weight: 40 });
  }

  // Ratings and review counts only exist on sources that carry them; absence of
  // the field is not evidence of absence of reviews.
  if (presence.reviewCount !== undefined && presence.reviewCount !== null) {
    if (!presence.reviewCount) {
      gaps.push({ code: 'no-reviews', label: 'No reviews at all', weight: 25 });
    } else if (presence.reviewCount < 10) {
      gaps.push({
        code: 'few-reviews',
        label: `Only ${presence.reviewCount} review(s)`,
        weight: 15,
      });
    }
  }

  if (
    presence.rating !== undefined &&
    presence.rating !== null &&
    presence.rating < 4
  ) {
    gaps.push({
      code: 'low-rating',
      label: `Rating of ${presence.rating.toFixed(1)}`,
      weight: 15,
    });
  }

  if (presence.hasOpeningHours === false) {
    gaps.push({
      code: 'no-hours',
      label: 'No opening hours published',
      weight: 10,
    });
  }

  if (isConfirmedlyAbsent(presence.phone)) {
    gaps.push({
      code: 'no-phone',
      label: 'No phone number listed',
      weight: 10,
    });
  }

  return gaps;
};

export const scoreGaps = (gaps: PresenceGap[]): number =>
  Math.min(
    100,
    gaps.reduce((total, gap) => total + gap.weight, 0)
  );

export const summarizeGaps = (gaps: PresenceGap[]): string =>
  gaps.map((gap) => gap.label).join('; ');

/** Bigger gaps mean more work to win, so the estimate tracks the score. */
export const estimateGapValue = (gapScore: number): number =>
  2000 + gapScore * 40;
