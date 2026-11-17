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

export interface LocalDirectoryPage {
  listings: LocalDirectoryListing[];
  hasMore: boolean;
  /** Optional so older gateway and Local Hub builds ignore it. */
  sourceFreshness?: LocalDirectorySourceFreshness;
}

export interface LocalDirectoryCursorPage extends LocalDirectoryPage {
  nextCursor: string | null;
}
