export type AppVisibility = 'public' | 'internal';

export type AppType = 'client' | 'admin' | 'user';

export interface AppRegistration {
  appId: string;
  name: string;
  domain: string;
  subdomain?: string;
  uiBaseUrl: string;
  apiBaseUrl: string;
  appType: AppType;
  visibility: AppVisibility;
  description?: string;
  iconUrl?: string;
  features?: Record<string, boolean>;
  sortOrder?: number;
  updatedAt?: string;
}

export interface AppRegistry {
  version: string;
  generatedAt: string;
  apps: AppRegistration[];
}

export interface AppRegistryResponse {
  success: boolean;
  data: AppRegistry;
  error?: string;
}
