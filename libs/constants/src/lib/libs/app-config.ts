export const APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES = [
  'AppConfigurationEntity',
  'AppInstanceEntity',
  'AppMembershipEntity',
] as const;

export const AppConfigCommands = {
  OPEN_ACCOUNT_EXPORT_CAPTURE: 'app-config.OpenAccountExportCapture',
  READ_ACCOUNT_EXPORT_CAPTURE: 'app-config.ReadAccountExportCapture',
  RELEASE_ACCOUNT_EXPORT_CAPTURE: 'app-config.ReleaseAccountExportCapture',
  Create: 'app-config.create',
  Get: 'app-config.get',
  GetPublishedByDomain: 'app-config.getPublishedByDomain',
  GetPublishedContextByDomain: 'app-config.getPublishedContextByDomain',
  GetByName: 'app-config.getByName',
  GetByContext: 'app-config.getByContext',
  GetAll: 'app-config.getAll',
  Update: 'app-config.update',
  Publish: 'app-config.publish',
  Rollback: 'app-config.rollback',
  Delete: 'app-config.delete',
  ResolveContext: 'app-config.resolveContext',
  DiscoverPublishedApps: 'app-config.discoverPublishedApps',
  ResolvePublishedApp: 'app-config.resolvePublishedApp',
  JoinPublishedApp: 'app-config.joinPublishedApp',
  RequestPublishedApp: 'app-config.requestPublishedApp',
};
