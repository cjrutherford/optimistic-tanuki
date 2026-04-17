import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const PERMISSION_TARGET_KEY = 'permission-target';

export interface PermissionRequirement {
  permissions: string[];
}

export interface PermissionTargetRequirement {
  source: 'params' | 'body' | 'query' | 'headers';
  path: string;
}

export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, { permissions });

export const PermissionTarget = (
  source: PermissionTargetRequirement['source'],
  path: string
) => SetMetadata(PERMISSION_TARGET_KEY, { source, path });
