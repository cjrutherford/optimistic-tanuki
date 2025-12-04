export const PermissionCommands = {
  Create: 'Create:Permission',
  Update: 'Update:Permission',
  Delete: 'Delete:Permission',
  Get: 'Get:Permission',
  GetAll: 'GetAll:Permission',
};

export const RoleCommands = {
  Create: 'Create:Role',
  Update: 'Update:Role',
  Delete: 'Delete:Role',
  Get: 'Get:Role',
  GetByName: 'GetByName:Role',
  GetAll: 'GetAll:Role',
  AddPermission: 'AddPermission:Role',
  RemovePermission: 'RemovePermission:Role',
  Assign: 'Assign:Role',
  Unassign: 'Unassign:Role',
  GetUserRoles: 'GetUserRoles:Role',
  CheckPermission: 'CheckPermission:Role',
};

export const AppScopeCommands = {
  Create: 'Create:AppScope',
  Update: 'Update:AppScope',
  Delete: 'Delete:AppScope',
  Get: 'Get:AppScope',
  GetByName: 'GetByName:AppScope',
  GetAll: 'GetAll:AppScope',
};

/**
 * List of all application scopes in the platform.
 * Used for owner-console registration to assign owner roles across all apps.
 */
export const ALL_APP_SCOPES = [
  'global',
  'forgeofwill',
  'client-interface',
  'digital-homestead',
  'christopherrutherford-net',
  'blogging',
  'project-planning',
  'assets',
  'social',
  'authentication',
  'profile',
  'owner-console',
] as const;

export type AppScopeName = (typeof ALL_APP_SCOPES)[number];
