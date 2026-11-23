import { NavigationLink } from './navigation.types';
import { AppRegistry } from './app-registry.types';

/** The registry the deployment ships: apps.yaml, generated to JSON. */
export interface RegistrySourceSnapshot {
  registry: AppRegistry;
  links: NavigationLink[];
}

/** What a stored audit row did, as the database records it. */
export type RegistryAuditEvent =
  | 'seed'
  | 'apps.updated'
  | 'links.updated'
  | 'publish'
  | 'rollback';

export interface RegistryAuditRecord {
  id: number;
  occurredAt: string;
  /** The legacy two-value action, kept so older readers keep working. */
  action: 'apps.updated' | 'links.updated';
  /** The precise event; `action` collapses publish, rollback and seed. */
  event: RegistryAuditEvent;
  summary: string;
  actor: string;
  reason?: string;
  releaseVersion?: number;
  metadata: Record<string, string | number | boolean>;
  before?: unknown;
  after?: unknown;
}

/**
 * - `in-sync`: the published registry equals the deployed YAML.
 * - `db-ahead`: the console published changes the YAML does not have.
 * - `yaml-changed`: the YAML changed since the last publish.
 * - `both`: each side changed.
 */
export type RegistryDriftState =
  | 'in-sync'
  | 'db-ahead'
  | 'yaml-changed'
  | 'both';

export interface RegistryDriftReport {
  state: RegistryDriftState;
  sourceHash: string;
  publishedHash: string | null;
  publishedVersion: number | null;
  /** Ids of apps whose definitions differ between YAML and the database. */
  changedApps: string[];
  addedInDatabase: string[];
  missingFromDatabase: string[];
  /** True when the working draft has edits that are not published. */
  hasUnpublishedChanges: boolean;
  /** The service could not reach the database, so this is a YAML-only guess. */
  degraded?: boolean;
}

export interface RegistryYamlExport {
  /** The current published registry as apps.yaml. */
  yaml: string;
  /** The deployed YAML, rendered the same way. */
  deployedYaml: string;
  /** Unified diff from the deployed YAML to the published registry. */
  diff: string;
  identical: boolean;
  publishedVersion: number | null;
  /** Navigation links are not part of apps.yaml and are not exported. */
  linksNotInYaml: number;
}
