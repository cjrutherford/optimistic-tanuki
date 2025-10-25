import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

export interface PermissionRequirement {
  permissions: string[];
  appScopeName: string;
}

export const RequirePermissions = (permissions: string[], appScopeName: string) =>
  SetMetadata(PERMISSIONS_KEY, { permissions, appScopeName });
