import { NavigationLink } from './navigation.types';

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
  authEmail?: {
    enabled: boolean;
    from: string;
    replyTo?: string;
  };
  sortOrder?: number;
  updatedAt?: string;
}

export interface AppRegistry {
  version: string;
  generatedAt: string;
  apps: AppRegistration[];
}

export type RegistryReleaseStatus = 'draft' | 'published' | 'changes-pending';

export interface RegistryReleaseSnapshot {
  registry: AppRegistry;
  links: NavigationLink[];
}

export interface RegistryReleaseRevision {
  version: number;
  status: 'published';
  publishedAt: string;
  releasedAt?: string;
  releaseNotes: string;
  changeSummary?: string;
  snapshot: RegistryReleaseSnapshot;
}

export interface RegistryReleaseState {
  status: RegistryReleaseStatus;
  previewUrl?: string;
  publishedVersion?: number;
  publishedAt?: string;
  releaseNotes?: string;
  changeSummary?: string;
  history: RegistryReleaseRevision[];
}

/** Where a registry read came from. */
export type AppRegistryOrigin = 'database' | 'cache' | 'yaml-fallback';

export interface AppRegistryResponse {
  success: boolean;
  data: AppRegistry;
  release?: RegistryReleaseState;
  /** Absent on older gateways. `yaml-fallback` means the database was down. */
  origin?: AppRegistryOrigin;
  error?: string;
}

export interface PublishRegistryDto {
  releaseNotes: string;
  changeSummary?: string;
  /** Why the owner is publishing; stored on the audit row. */
  reason?: string;
}

export interface RollbackRegistryDto {
  version: number;
  releaseNotes: string;
  /** Why the owner is rolling back; stored on the audit row. */
  reason?: string;
}

export interface RegistryReleaseBundle {
  registry: AppRegistry;
  links: NavigationLink[];
  release: RegistryReleaseState;
}

export interface RegistryReleaseBundleResponse {
  success: boolean;
  data: RegistryReleaseBundle;
  error?: string;
}
