export const ACCOUNT_DELETION_ENVIRONMENT_COMMAND =
  'accountDeletion.environment';
export const ACCOUNT_DELETION_RUNTIME_CUSTODY_COMMAND =
  'accountDeletion.runtimeCustody';
export const ACCOUNT_DELETION_RUNTIME_READBACK_COMMAND =
  'accountDeletion.runtimeReadback' as const;
import { ACCOUNT_EXPORT_RELEASE_OWNERS } from '../account-export/account-export-release-coverage';

/** Shared, transport-safe contract for account deletion orchestration. */
export const ACCOUNT_DELETION_CONTRACT_VERSION = 1 as const;
export const ACCOUNT_DELETION_SNAPSHOT_PURGE_COMMAND =
  'accountDeletion.purgeSnapshots';

export const ACCOUNT_DELETION_APP_IDS = Object.freeze([
  'client-interface',
  'local-hub',
] as const);

export const ACCOUNT_DELETION_OWNERS = ACCOUNT_EXPORT_RELEASE_OWNERS;

export type AccountDeletionAction = 'fence' | 'erase' | 'readback' | 'finalize';
export type AccountDeletionState =
  | 'fencing'
  | 'deleting'
  | 'blocked'
  | 'complete';
export type AccountDeletionAppId = (typeof ACCOUNT_DELETION_APP_IDS)[number];
export type AccountDeletionOwner = (typeof ACCOUNT_DELETION_OWNERS)[number];

export interface AccountDeletionGrant {
  contractVersion: typeof ACCOUNT_DELETION_CONTRACT_VERSION;
  operationId: string;
  accountId: string;
  appId: AccountDeletionAppId;
  owner: AccountDeletionOwner;
  action: AccountDeletionAction;
  attempt: number;
  leaseOwner: string;
  expiresAt: string;
  signature: string;
}

export interface AccountDeletionIdentityDomains {
  /** Identifiers established by authority validation, never supplied as grant input. */
  currentProfileIds: readonly string[];
  /** Legacy storage keys; intentionally a different namespace from profile UUIDs. */
  legacyProfileIds: readonly string[];
}

export interface AccountDeletionOwnerStatus {
  owner: AccountDeletionOwner;
  status: 'pending' | 'running' | 'blocked' | 'complete';
}

/** Public progress projection. It must never contain account/profile IDs or capabilities. */
export interface AccountDeletionStatus {
  contractVersion: typeof ACCOUNT_DELETION_CONTRACT_VERSION;
  operationId: string;
  appId: AccountDeletionAppId;
  state: AccountDeletionState;
  attempt: number;
  progress: readonly AccountDeletionOwnerStatus[];
  createdAt: string;
  updatedAt: string;
}

export interface DeletedAccountPlaceholder {
  readonly kind: 'deleted-account';
  readonly label: 'Deleted account';
  readonly profileId: null;
  readonly userId: null;
  readonly avatarUrl: null;
}

/** Storage sentinel only; never a valid actor identity. */
export const DELETED_ACCOUNT_ID =
  '00000000-0000-0000-0000-000000000000' as const;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CANONICAL_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const SIGNATURE = /^[0-9a-f]{64}$/;
const ACTIONS: readonly string[] = ['fence', 'erase', 'readback', 'finalize'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isActorUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    UUID.test(value) &&
    value === value.toLowerCase() &&
    value !== DELETED_ACCOUNT_ID
  );
}

function isCanonicalIso(value: unknown): value is string {
  if (typeof value !== 'string' || !CANONICAL_ISO.test(value)) return false;
  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
  );
}

export function validateDeletionGrantShape(
  value: unknown
): value is AccountDeletionGrant {
  if (!isRecord(value)) return false;
  const keys = [
    'contractVersion',
    'operationId',
    'accountId',
    'appId',
    'owner',
    'action',
    'attempt',
    'leaseOwner',
    'expiresAt',
    'signature',
  ];
  if (
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !hasOwn(value, key))
  )
    return false;
  return (
    value['contractVersion'] === ACCOUNT_DELETION_CONTRACT_VERSION &&
    isActorUuid(value['operationId']) &&
    isActorUuid(value['accountId']) &&
    (ACCOUNT_DELETION_APP_IDS as readonly unknown[]).includes(value['appId']) &&
    (ACCOUNT_DELETION_OWNERS as readonly unknown[]).includes(value['owner']) &&
    ACTIONS.includes(value['action'] as string) &&
    Number.isSafeInteger(value['attempt']) &&
    (value['attempt'] as number) >= 1 &&
    isActorUuid(value['leaseOwner']) &&
    isCanonicalIso(value['expiresAt']) &&
    typeof value['signature'] === 'string' &&
    SIGNATURE.test(value['signature'])
  );
}

export function validateDeletionIdentityDomains(
  value: unknown
): value is AccountDeletionIdentityDomains {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 2 ||
    !hasOwn(value, 'currentProfileIds') ||
    !hasOwn(value, 'legacyProfileIds')
  )
    return false;
  const current = value['currentProfileIds'];
  const legacy = value['legacyProfileIds'];
  if (
    !Array.isArray(current) ||
    !Array.isArray(legacy) ||
    current.length + legacy.length > 1000
  )
    return false;
  if (
    current.some((id) => !isActorUuid(id)) ||
    legacy.some(
      (id) =>
        typeof id !== 'string' ||
        id.length === 0 ||
        id.length > 512 ||
        id.trim() !== id ||
        (UUID.test(id) && id !== id.toLowerCase())
    )
  )
    return false;
  return (
    new Set(current).size === current.length &&
    new Set(legacy).size === legacy.length
  );
}

export function deletedAccountPlaceholder(): DeletedAccountPlaceholder {
  return Object.freeze({
    kind: 'deleted-account',
    label: 'Deleted account',
    profileId: null,
    userId: null,
    avatarUrl: null,
  });
}

/** Matches only the exact string storage sentinel, never object fields or coercions. */
export function isDeletedAccountIdentity(
  value: unknown
): value is typeof DELETED_ACCOUNT_ID {
  return value === DELETED_ACCOUNT_ID;
}
