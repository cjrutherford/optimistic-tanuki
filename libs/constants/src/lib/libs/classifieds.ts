export const CLASSIFIEDS_ACCOUNT_EXPORT_CAPTURE_SOURCES = [
  'ClassifiedAdEntity',
] as const;

/**
 * Commands for the Classifieds microservice.
 */
export const ClassifiedCommands = {
  OPEN_ACCOUNT_EXPORT_CAPTURE: 'classified.OpenAccountExportCapture',
  READ_ACCOUNT_EXPORT_CAPTURE: 'classified.ReadAccountExportCapture',
  RELEASE_ACCOUNT_EXPORT_CAPTURE: 'classified.ReleaseAccountExportCapture',
  // Classified ad CRUD
  CREATE: 'classified.create',
  UPDATE: 'classified.update',
  DELETE: 'classified.delete',
  FIND_BY_ID: 'classified.findById',
  FIND_BY_USER: 'classified.findByUser',
  FIND_BY_COMMUNITY: 'classified.findByCommunity',
  FIND_BY_PROFILE: 'classified.findByProfile',
  FIND_ASSET_AUDIENCES: 'classified.findAssetAudiences',
  SEARCH: 'classified.search',
  // Lifecycle management
  MARK_SOLD: 'classified.markSold',
  EXPIRE: 'classified.expire',
  RESTORE: 'classified.restore',
  // Featured listings
  FEATURE: 'classified.feature',
  UNFEATURE: 'classified.unfeature',
};
