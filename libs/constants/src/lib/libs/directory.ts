/**
 * Sources of the Directory account export capture. The last one is a single
 * receipt row stating whether rows were withheld as ambiguous.
 */
export const DIRECTORY_ACCOUNT_EXPORT_CAPTURE_SOURCES = [
  'DirectoryBusinessLinkRequest',
  'DirectoryBusinessLinkEvent',
  'DirectoryBoundaryDecision',
  'DirectoryAddressReviewDecision',
  'DirectoryExportCoverage',
] as const;
