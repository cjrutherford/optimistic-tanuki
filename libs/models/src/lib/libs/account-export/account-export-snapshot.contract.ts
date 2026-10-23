/** Internal capabilities. Never expose a lease nonce or session in public status. */
export interface AccountExportCaptureGrant {
  accountId: string;
  appId: string;
  token: string;
  jobId: string;
  attempt: number;
  leaseOwner: string;
}

export const ACCOUNT_EXPORT_SNAPSHOT_LIMITS = {
  readBytes: 64 * 1024,
  lineBytes: 512 * 1024,
  captureBytes: 256 * 1024 * 1024,
  aggregateBytes: 512 * 1024 * 1024,
  entries: 2,
  identityPages: 32768,
  identityPageSize: 100,
  ttlMs: 120_000,
} as const;

export interface AccountExportSnapshotDescriptor {
  handleId: string;
  participantId: string;
  accountId: string;
  captureId: string;
  snapshotAt: string;
  sizeBytes: number;
  sha256: string;
  rowCount: number;
  sources: string[];
  sourceRowCounts: Record<string, number>;
  sourceDispositions: Record<string, string>;
  identityCount: number;
  expiresAt: string;
}

export interface AccountExportSnapshotRequest
  extends AccountExportCaptureGrant {
  handleId: string;
}

export interface AccountExportSnapshotReadRequest
  extends AccountExportSnapshotRequest {
  offset: number;
  length: number;
}

export interface AccountExportSnapshotReadResult {
  handleId: string;
  captureId: string;
  offset: number;
  bytesBase64: string;
  eof: boolean;
}

export interface AccountExportSnapshotIdentityRequest
  extends AccountExportSnapshotRequest {
  offset: number;
  limit: number;
}

export interface AccountExportSnapshotIdentityPage {
  handleId: string;
  captureId: string;
  accountId: string;
  snapshotAt: string;
  profileIds: string[];
  total: number;
  nextOffset: number | null;
}

/** Shape only; the owner must still validate the live session and DB-clock lease. */
export function isAccountExportCaptureGrant(
  value: unknown
): value is AccountExportCaptureGrant {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const uuid = (s: unknown) =>
    typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
  return (
    uuid(v['accountId']) &&
    uuid(v['jobId']) &&
    uuid(v['leaseOwner']) &&
    typeof v['appId'] === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(v['appId']) &&
    typeof v['token'] === 'string' &&
    v['token'].trim().length > 0 &&
    v['token'].length <= 8192 &&
    typeof v['attempt'] === 'number' &&
    Number.isSafeInteger(v['attempt']) &&
    v['attempt'] > 0 &&
    v['attempt'] <= 2147483647
  );
}

/** Assets capture is derived from these exact leased Profile identities. */
export interface AssetsAccountExportSnapshotOpenRequest
  extends AccountExportCaptureGrant {
  profileSnapshot: AccountExportSnapshotDescriptor;
}
export interface ProfileBoundAccountExportSnapshotDescriptor
  extends AccountExportSnapshotDescriptor {
  profileHandleId: string;
  profileCaptureId: string;
  profileSnapshotAt: string;
}

export type AssetsAccountExportSnapshotDescriptor =
  ProfileBoundAccountExportSnapshotDescriptor;
export type VideosAccountExportSnapshotDescriptor =
  ProfileBoundAccountExportSnapshotDescriptor;
export type VideosAccountExportSnapshotOpenRequest =
  AssetsAccountExportSnapshotOpenRequest;
export type PermissionsAccountExportSnapshotDescriptor =
  ProfileBoundAccountExportSnapshotDescriptor;
export type PermissionsAccountExportSnapshotOpenRequest =
  AssetsAccountExportSnapshotOpenRequest;

export type SocialAccountExportSnapshotDescriptor =
  ProfileBoundAccountExportSnapshotDescriptor;
export type SocialAccountExportSnapshotOpenRequest =
  AssetsAccountExportSnapshotOpenRequest;
export type ForumAccountExportSnapshotDescriptor =
  ProfileBoundAccountExportSnapshotDescriptor;
export type ForumAccountExportSnapshotOpenRequest =
  AssetsAccountExportSnapshotOpenRequest;
export type WorkspaceAccountExportSnapshotDescriptor =
  ProfileBoundAccountExportSnapshotDescriptor;
export type WorkspaceAccountExportSnapshotOpenRequest =
  AssetsAccountExportSnapshotOpenRequest;

export type AppConfiguratorAccountExportSnapshotDescriptor =
  ProfileBoundAccountExportSnapshotDescriptor;
export type AppConfiguratorAccountExportSnapshotOpenRequest =
  AssetsAccountExportSnapshotOpenRequest;

export type ChatAccountExportSnapshotDescriptor =
  ProfileBoundAccountExportSnapshotDescriptor;
export type ChatAccountExportSnapshotOpenRequest =
  AssetsAccountExportSnapshotOpenRequest;

export type ClassifiedsAccountExportSnapshotDescriptor =
  ProfileBoundAccountExportSnapshotDescriptor;
export type ClassifiedsAccountExportSnapshotOpenRequest =
  AssetsAccountExportSnapshotOpenRequest;
