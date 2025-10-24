import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const APPSCOPE_KEY = 'appScope';

export interface PermissionRequirement {
  permissions: string[];
  appScope: string;
}

export const RequirePermissions = (permissions: string[], appScope: string) =>
  SetMetadata(PERMISSIONS_KEY, { permissions, appScope });
