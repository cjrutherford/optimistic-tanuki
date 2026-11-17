import type {
  LocalDirectoryCoverage,
  LocalDirectoryListing,
  LocalDirectorySourceFreshness,
} from '@optimistic-tanuki/social-contracts';

export type { LocalDirectoryCoverage, LocalDirectoryListing };
export type { LocalDirectorySourceFreshness };

/** A filter submission from the filter bar. Empty strings mean "not set". */
export interface DirectoryFilters {
  q: string;
  category: string;
  adult: boolean;
}

export type DirectoryBadgeKind = 'business-page' | 'directory-listing';

/** A town offered as a neighbour of the current one. */
export interface DirectoryNearbyTown {
  name: string;
  slug: string;
  adminArea?: string;
  distanceMiles?: number;
}
