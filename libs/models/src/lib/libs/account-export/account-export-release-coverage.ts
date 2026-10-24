/** Fixed release scope for OT/TS account export capture evidence. */
export const ACCOUNT_EXPORT_RELEASE_COVERAGE_VERSION =
  '2026-10-24.ot-ts.v1' as const;

export const ACCOUNT_EXPORT_RELEASE_SCOPE = Object.freeze([
  'client-interface',
  'local-hub',
] as const);

export const ACCOUNT_EXPORT_RELEASE_OWNERS = Object.freeze([
  'authentication',
  'profile',
  'assets',
  'videos',
  'permissions',
  'social',
  'forum',
  'workspace',
  'app-configurator',
  'chat-collector',
  'classifieds',
  'payments',
] as const);

/** Non-ORM records and artifacts have explicit release dispositions. */
export const ACCOUNT_EXPORT_RELEASE_NON_ORM_DISPOSITIONS = Object.freeze({
  N01: 'operational job/outbox state excluded; durable personal source records captured by owners; no credentials',
  N02: 'session/cache/PKCE/callback state excluded; no bearer credentials',
  N03: 'personal search history captured by Social; no separate search index evidenced in registered catalogs',
  N04: 'typed personal audit receipts captured by owners; diagnostic logs excluded; deployed copies operator-qualified',
  N05: 'verified owned media handled in artifact stage; storage keys, old versions and encryption material excluded',
  N06: 'browser/session state and local preferences excluded',
  N07: 'safe provider identity receipts captured by Authentication; provider tokens excluded',
} as const);

/** Any unresolved store disposition remains an explicit coverage blocker. */
export const ACCOUNT_EXPORT_RELEASE_PENDING_DISPOSITIONS: Readonly<
  Record<string, string>
> = Object.freeze({});

export const ACCOUNT_EXPORT_RELEASE_COVERAGE_INVENTORY = Object.freeze({
  version: ACCOUNT_EXPORT_RELEASE_COVERAGE_VERSION,
  appIds: ACCOUNT_EXPORT_RELEASE_SCOPE,
  owners: ACCOUNT_EXPORT_RELEASE_OWNERS,
  required: true,
  pendingDispositions: ACCOUNT_EXPORT_RELEASE_PENDING_DISPOSITIONS,
  nonOrmDispositions: ACCOUNT_EXPORT_RELEASE_NON_ORM_DISPOSITIONS,
} as const);

export interface AccountExportReleaseCaptureMetadata {
  participantId: string;
  accountId: string;
  captureId: string;
  snapshotAt: string;
  sizeBytes: number;
  sha256: string;
  rowCount: number;
  sourceRowCounts: Readonly<Record<string, number>>;
  sourceDispositions: Readonly<Record<string, string>>;
}

export interface AccountExportReleaseCoverage {
  coverageVersion: typeof ACCOUNT_EXPORT_RELEASE_COVERAGE_VERSION;
  complete: boolean;
  blockers: readonly string[];
  artifactReady: false;
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;
const ISO_DATETIME =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}(?::?\d{2})?)$/;

/**
 * Evaluates capture evidence for a trusted server-selected app/account/source
 * registry. The caller cannot alter the accepted scope or required owners.
 */
export function evaluateAccountExportReleaseCoverage(
  appId: string,
  expectedAccountId: string,
  metadata: readonly AccountExportReleaseCaptureMetadata[],
  expectedSourcesByOwner: Readonly<Record<string, readonly string[]>>
): AccountExportReleaseCoverage {
  const blockers = new Set<string>();
  for (const owner of Object.keys(
    ACCOUNT_EXPORT_RELEASE_PENDING_DISPOSITIONS
  )) {
    blockers.add(`unaccepted-owner:${owner}`);
  }
  const acceptedApp = (
    ACCOUNT_EXPORT_RELEASE_SCOPE as readonly string[]
  ).includes(appId);
  if (!acceptedApp) blockers.add(`unsupported-app:${String(appId)}`);
  if (!UUID.test(expectedAccountId))
    blockers.add('invalid-expected-account-id');

  const registryOwners = Object.keys(expectedSourcesByOwner).sort();
  for (const owner of ACCOUNT_EXPORT_RELEASE_OWNERS) {
    const sources = expectedSourcesByOwner[owner];
    if (!Array.isArray(sources) || sources.length === 0) {
      blockers.add(`invalid-source-registry:${owner}`);
      continue;
    }
    if (
      new Set(sources).size !== sources.length ||
      sources.some((s) => typeof s !== 'string' || !s.trim())
    )
      blockers.add(`invalid-source-registry:${owner}`);
  }
  for (const owner of registryOwners) {
    if (!(ACCOUNT_EXPORT_RELEASE_OWNERS as readonly string[]).includes(owner))
      blockers.add(`unknown-source-registry-owner:${owner}`);
  }
  for (const owner of ACCOUNT_EXPORT_RELEASE_OWNERS) {
    if (!registryOwners.includes(owner))
      blockers.add(`missing-source-registry-owner:${owner}`);
  }

  const seenOwners = new Map<string, number>();
  for (const raw of metadata as readonly unknown[]) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      blockers.add('invalid-capture-metadata');
      continue;
    }
    const item = raw as Partial<AccountExportReleaseCaptureMetadata>;
    const owner =
      typeof item.participantId === 'string' && item.participantId
        ? item.participantId
        : 'unknown';
    seenOwners.set(owner, (seenOwners.get(owner) ?? 0) + 1);
    if (!(ACCOUNT_EXPORT_RELEASE_OWNERS as readonly string[]).includes(owner)) {
      blockers.add(`unknown-owner:${owner}`);
      continue;
    }
    if (
      item.accountId !== expectedAccountId ||
      !UUID.test(item.accountId ?? '')
    )
      blockers.add(`foreign-account:${owner}`);
    if (!UUID.test(item.captureId ?? ''))
      blockers.add(`invalid-capture-id:${owner}`);
    if (
      typeof item.snapshotAt !== 'string' ||
      !ISO_DATETIME.test(item.snapshotAt) ||
      !Number.isFinite(Date.parse(item.snapshotAt))
    )
      blockers.add(`invalid-snapshot-at:${owner}`);
    if (!Number.isSafeInteger(item.sizeBytes) || (item.sizeBytes ?? -1) < 0)
      blockers.add(`invalid-size-bytes:${owner}`);
    if (!SHA256.test(item.sha256 ?? ''))
      blockers.add(`invalid-sha256:${owner}`);
    if (!Number.isSafeInteger(item.rowCount) || (item.rowCount ?? -1) < 0)
      blockers.add(`invalid-row-count:${owner}`);

    const expectedSources = expectedSourcesByOwner[owner];
    if (!Array.isArray(expectedSources)) {
      blockers.add(`missing-source-registry:${owner}`);
      continue;
    }
    const counts = item.sourceRowCounts;
    const dispositions = item.sourceDispositions;
    if (!counts || typeof counts !== 'object' || Array.isArray(counts)) {
      blockers.add(`invalid-source-row-counts:${owner}`);
      continue;
    }
    if (
      !dispositions ||
      typeof dispositions !== 'object' ||
      Array.isArray(dispositions)
    ) {
      blockers.add(`invalid-source-dispositions:${owner}`);
      continue;
    }
    const expected = new Set(expectedSources);
    for (const source of expectedSources) {
      const count = counts[source];
      if (!Number.isSafeInteger(count) || (count ?? -1) < 0)
        blockers.add(`invalid-source-row-count:${owner}:${source}`);
      const disposition = dispositions[source];
      if (
        typeof disposition !== 'string' ||
        disposition.trim().length === 0 ||
        disposition.length > 4096
      )
        blockers.add(`missing-source-disposition:${owner}:${source}`);
    }
    for (const source of Object.keys(counts)) {
      if (!expected.has(source))
        blockers.add(`extra-source-row-count:${owner}:${source}`);
    }
    for (const source of Object.keys(dispositions)) {
      if (!expected.has(source))
        blockers.add(`extra-source-disposition:${owner}:${source}`);
    }
    if (
      expectedSources.every(
        (source) =>
          Number.isSafeInteger(counts[source]) && (counts[source] ?? -1) >= 0
      )
    ) {
      const total = expectedSources.reduce(
        (sum, source) => sum + counts[source],
        0
      );
      if (!Number.isSafeInteger(total) || total !== item.rowCount)
        blockers.add(`source-row-count-total-mismatch:${owner}`);
    }
  }

  for (const owner of ACCOUNT_EXPORT_RELEASE_OWNERS) {
    const count = seenOwners.get(owner) ?? 0;
    if (count === 0) blockers.add(`missing-owner:${owner}`);
    if (count > 1) blockers.add(`duplicate-owner:${owner}`);
  }
  if (!acceptedApp) blockers.add('unsupported-scope');
  const sorted = [...blockers].sort();
  return {
    coverageVersion: ACCOUNT_EXPORT_RELEASE_COVERAGE_VERSION,
    complete: sorted.length === 0,
    blockers: sorted,
    artifactReady: false,
  };
}
