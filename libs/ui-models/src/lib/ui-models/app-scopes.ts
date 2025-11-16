export interface AppScopeDto {
  id: string;
  name: string;
  description: string;
  active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface CreateAppScopeDto {
  name: string;
  description: string;
  active: boolean;
}

export interface UpdateAppScopeDto {
  name?: string;
  description?: string;
  active?: boolean;
}
