export interface PermissionDto {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  targetId?: string;
  appScope?: any;
  created_at?: Date;
}

export interface CreatePermissionDto {
  name: string;
  description: string;
  resource: string;
  action: string;
  targetId?: string;
}

export interface UpdatePermissionDto {
  name?: string;
  description?: string;
  resource?: string;
  action?: string;
  targetId?: string;
}
