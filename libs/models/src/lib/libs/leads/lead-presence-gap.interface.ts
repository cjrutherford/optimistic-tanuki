/**
 * A specific, nameable shortfall in a business's online presence.
 *
 * Both local-business sources — Google Places and OSM Overpass — exist to find
 * these, because a gap is the reason to make contact: "you have no website" is
 * a sentence a stranger will read to the end. The shape lives here rather than
 * beside the scorer so it can be stored on the lead itself; it used to survive
 * only as prose inside the lead's notes, where nothing could sort or filter on
 * it and the operator had to read a paragraph to find out why the lead existed.
 */
export interface PresenceGap {
  /** Stable identifier for the kind of gap, e.g. `no-website`. */
  code: string;
  /** Human-readable, and specific where the source gave a figure. */
  label: string;
  /** How much this gap contributes to the lead's overall gap score. */
  weight: number;
}
