export type GeographyDecision = 'include' | 'withhold' | 'uncertain';
export type RuleVersion = string;

/** Descriptive locality label (town, city, village, county, planning-region,
 * state, ...). Behavior comes from the locality graph, never from this label. */
export type LocalityKind = string;

/**
 * How items from a source apply to editions below the source's owner.
 * - `all`: every item applies to every place under the owner (for example,
 *   county commission minutes).
 * - `mentions`: an item applies only when it names the edition, a place
 *   inside it, or a non-broad place between the edition and the source
 *   owner (the owner included).
 */
export type SourceCoverage = 'all' | 'mentions';

export function isEditionIncluded(
  decision: GeographyDecision
): decision is 'include' {
  return decision === 'include';
}
