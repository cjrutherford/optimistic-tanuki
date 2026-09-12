export const PermissionCommands = {
  Create: 'Create:Permission',
  Update: 'Update:Permission',
  Delete: 'Delete:Permission',
  Get: 'Get:Permission',
  GetAll: 'GetAll:Permission',
  Search: 'Search:Permission',
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
  PreviewBulkMutation: 'PreviewBulkMutation:Role',
  ExecuteBulkMutation: 'ExecuteBulkMutation:Role',
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
 * Permission contract used when a workspace is provisioned for an app.
 * The role is looked up in the app scope and assigned only to the workspace
 * child scope, so app owners cannot inherit another app's authority.
 */
export const WORKSPACE_OWNER_PERMISSION_CONTRACTS = {
  'business-site': {
    appScope: 'business-site',
    roleName: 'business_site_owner',
    label: 'Business site',
  },
  'configurable-client': {
    appScope: 'configurable-client',
    roleName: 'configurable_client_owner',
    label: 'Configurable client',
  },
} as const;

export type WorkspaceOwnerAppScope =
  keyof typeof WORKSPACE_OWNER_PERMISSION_CONTRACTS;
export type WorkspaceOwnerPermissionContract =
  (typeof WORKSPACE_OWNER_PERMISSION_CONTRACTS)[WorkspaceOwnerAppScope];

export function getWorkspaceOwnerPermissionContract(
  appScope: string
): WorkspaceOwnerPermissionContract | undefined {
  return WORKSPACE_OWNER_PERMISSION_CONTRACTS[
    appScope as WorkspaceOwnerAppScope
  ];
}

/**
 * List of all application scopes in the platform.
 * Used for owner-console registration to assign owner roles across all apps.
 */
export const ALL_APP_SCOPES = [
  'global',
  'forgeofwill',
  'client-interface',
  'leads-app',
  'digital-homestead',
  'christopherrutherford-net',
  'blogging',
  'project-planning',
  'assets',
  'social',
  'authentication',
  'profile',
  'owner-console',
  'store',
  'store-client',
  'business-site',
  'configurable-client',
  'forum',
  'D6',
  'wellness',
  'local-hub',
  'learning',
] as const;

export type AppScopeName = (typeof ALL_APP_SCOPES)[number];
