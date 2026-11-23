import type {
  AppRegistration,
  NavigationLink,
  RegistryAuditEvent,
} from '@optimistic-tanuki/app-registry-backend';

export interface WorkingRegistry {
  version: string;
  generatedAt: string;
  apps: AppRegistration[];
  links: NavigationLink[];
}

export interface ReleaseRecord {
  version: number;
  isCurrent: boolean;
  snapshot: {
    registry: {
      version: string;
      generatedAt: string;
      apps: AppRegistration[];
    };
    links: NavigationLink[];
  };
  releaseNotes: string;
  changeSummary: string | null;
  sourceHash: string | null;
  restoredFromVersion: number | null;
  publishedAt: Date;
  publishedBy: string;
}

export interface AuditRecord {
  id?: number;
  action: RegistryAuditEvent;
  actor: string;
  summary: string;
  reason: string | null;
  releaseVersion: number | null;
  before: unknown;
  after: unknown;
  metadata: Record<string, string | number | boolean>;
  createdAt?: Date;
}

/**
 * Persistence the registry service needs. Each write is one transaction, so
 * a release, the working copy and its audit row always land together.
 */
export interface RegistryStore {
  loadWorking(): Promise<WorkingRegistry | null>;
  /** Releases, newest first. */
  listReleases(): Promise<ReleaseRecord[]>;
  listAudit(limit: number): Promise<AuditRecord[]>;
  /** Writes only when no release exists yet. Returns whether it wrote. */
  seed(
    working: WorkingRegistry,
    release: ReleaseRecord,
    audit: AuditRecord
  ): Promise<boolean>;
  saveDraft(working: WorkingRegistry, audit: AuditRecord[]): Promise<void>;
  /** Makes `release` current; `working` replaces the draft when given. */
  saveRelease(
    release: ReleaseRecord,
    working: WorkingRegistry | null,
    audit: AuditRecord
  ): Promise<void>;
}

export const REGISTRY_STORE = 'REGISTRY_STORE';
