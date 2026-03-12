/**
 * Commands for the Classifieds microservice.
 */
export const ClassifiedCommands = {
  // Classified ad CRUD
  CREATE: 'classified.create',
  UPDATE: 'classified.update',
  DELETE: 'classified.delete',
  FIND_BY_ID: 'classified.findById',
  FIND_BY_COMMUNITY: 'classified.findByCommunity',
  FIND_BY_PROFILE: 'classified.findByProfile',
  SEARCH: 'classified.search',
  // Lifecycle management
  MARK_SOLD: 'classified.markSold',
  EXPIRE: 'classified.expire',
  RESTORE: 'classified.restore',
  // Featured listings
  FEATURE: 'classified.feature',
  UNFEATURE: 'classified.unfeature',
};

/**
 * Commands for Local Community management within the Classifieds microservice.
 */
export const LocalCommunityCommands = {
  LIST: 'local-community.list',
  FIND_BY_SLUG: 'local-community.findBySlug',
  JOIN: 'local-community.join',
  LEAVE: 'local-community.leave',
  IS_MEMBER: 'local-community.isMember',
};
