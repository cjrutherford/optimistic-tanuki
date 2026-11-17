/** Local-evaluation projection. Only reviewed business addresses have coordinates. */
export interface LocalDirectoryListing {
  /**
   * Stable public id. For a business carried across source releases this is the business id and keeps resolving
   * to the new release's row; otherwise it is scoped to one imported row. Clients cannot tell which, it is not an
   * ownership claim, and an id that no longer resolves is a 404. Resolution returns the canonical id, so clients
   * should store the id from the response. Cursors and references are not durable and end at a release cutover.
   */
  id?: string;
  name: string;
  category: string;
  attribution: string[];
  notices: string[];
  termsUrls?: string[];
  website?: string;
  phone?: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  /** Short-lived opaque reference, available only in cursor mode. */
  reference?: string;
}

/** Label only: where the data came from and how old the upstream object was. Never filters a page. */
export interface LocalDirectorySourceFreshness {
  state: 'fresh' | 'due' | 'stale' | 'unknown';
  /** Overture release label, e.g. 2026-10-21.0. Null when state is unknown. */
  releaseId: string | null;
  /** Upstream object timestamp (Last-Modified), not a release publication date. */
  sourcePublishedAt: string | null;
  /** When Directory recorded the scan completion. */
  acquiredAt: string | null;
  thresholds: { freshDays: number; staleDays: number };
}

/**
 * What Directory can prove about a town's coverage, from persisted facts only. Independent of `sourceFreshness`
 * and never used to hide listings. A failed request is not a coverage state: it is an HTTP error.
 *
 *  - available: at least one listing is served.
 *  - empty: a completed, unrevoked, policy-active scan targeted this town and no listing remains.
 *  - acquiring: a scan targeting this town has started and none targeting it has completed.
 *  - partial: listings are served from a completed scan while a newer scan targeting the town is still acquiring.
 *  - blocked: the town is not served by policy (`reason` says which).
 *  - unknown: Directory has no recorded scan target for this town, so it cannot say whether it was scanned.
 */
export type LocalDirectoryCoverageState =
  | 'available'
  | 'empty'
  | 'acquiring'
  | 'partial'
  | 'blocked'
  | 'unknown';

/** `town-ineligible`: the town is not eligible for the directory. `policy-withdrawn`: every scan covering it was withdrawn. */
export type LocalDirectoryCoverageReason =
  | 'town-ineligible'
  | 'policy-withdrawn';

export interface LocalDirectoryCoverage {
  state: LocalDirectoryCoverageState;
  /** Present only when state is `blocked`. */
  reason?: LocalDirectoryCoverageReason;
  /**
   * Count of served listings whose reviewed details (address, contact, map point) are withheld until their source
   * binding is re-verified. The listings themselves are still served. Count only: no ids, no causes.
   */
  withheldReviewedDetails: number;
}

export interface LocalDirectoryPage {
  listings: LocalDirectoryListing[];
  hasMore: boolean;
  /** Optional so older gateway and Local Hub builds ignore it. */
  sourceFreshness?: LocalDirectorySourceFreshness;
  /** Optional so older gateway and Local Hub builds ignore it. Absent means the same as `unknown`. */
  coverage?: LocalDirectoryCoverage;
}

export interface LocalDirectoryCursorPage extends LocalDirectoryPage {
  nextCursor: string | null;
}
