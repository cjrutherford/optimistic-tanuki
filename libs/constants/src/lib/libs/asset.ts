export const AssetCommands = {
  FENCE_ACCOUNT_DELETION: 'asset.deletion.fence',
  ERASE_ACCOUNT_DELETION: 'asset.deletion.erase',
  READBACK_ACCOUNT_DELETION: 'asset.deletion.readback',
  OPEN_ACCOUNT_EXPORT_CAPTURE: 'asset.export.open',
  READ_ACCOUNT_EXPORT_CAPTURE: 'asset.export.read',
  RELEASE_ACCOUNT_EXPORT_CAPTURE: 'asset.export.release',
  CREATE: 'asset.create',
  REMOVE: 'asset.remove',
  RETRIEVE: 'asset.retrieve',
  READ: 'asset.read',
  LIST: 'asset.list',
  ADD_COMMUNITY_AUDIENCE: 'asset.addCommunityAudience',
  ADD_AUDIENCE_RESTRICTIONS: 'asset.addAudienceRestrictions',
  GUARDIAN_CREATE: 'asset.guardian.create',
  GUARDIAN_LIST: 'asset.guardian.list',
  GUARDIAN_REMOVE: 'asset.guardian.remove',
  GUARDIAN_AUTHORIZE_READ: 'asset.guardian.authorizeRead',
};

export const ASSETS_ACCOUNT_EXPORT_CAPTURE_SOURCES = [
  'asset',
  'assetMedia',
  'guardianActivity',
] as const;
