import { createHash } from 'node:crypto';
import { In } from 'typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import {
  FetchAttemptSchema,
  FetchLedgerSchema,
  RawDocumentSchema,
  RawDocumentVersionSchema,
  FoundationQuarantineSchema,
  type FetchLedgerRow,
} from './schema.js';
import { validateBlobRef } from './blob-store.js';
import type { CoverageRange, FetchResult } from './types.js';

export type FetchOutcome =
  | 'changed'
  | 'unchanged'
  | 'not-modified'
  | 'failed'
  | 'ignored-stale';
export type FetchLedgerState = FetchLedgerRow & {
  lastChecksum?: string | null;
};

function checksum(body: string): string {
  return createHash('sha256').update(body).digest('hex');
}

/** Canonical URL identity used by ledger, immutable versions, and current rows. */
export function canonicalUrl(value: string): string {
  const url = new URL(value);
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

function errorText(result: Extract<FetchResult, { kind: 'failed' }>): string {
  return JSON.stringify(result.error);
}

export function nextFetchState(
  previous: FetchLedgerState | undefined,
  result: FetchResult
): { outcome: FetchOutcome; ledger: FetchLedgerState } {
  const url = canonicalUrl(result.url);
  const prior: FetchLedgerState = previous ?? {
    sourceId: '',
    url,
    consecutiveFailures: 0,
  };
  if (
    prior.lastAttemptAt &&
    Date.parse(result.fetchedAt) < Date.parse(prior.lastAttemptAt)
  ) {
    const outcome = 'ignored-stale';
    return { outcome, ledger: { ...prior, url } };
  }
  const base: FetchLedgerState = {
    ...prior,
    url,
    lastAttemptAt: result.fetchedAt,
    lastStatus: result.status,
  };
  if (result.kind === 'failed')
    return {
      outcome: 'failed',
      ledger: {
        ...base,
        consecutiveFailures: (prior.consecutiveFailures ?? 0) + 1,
        lastError: errorText(result),
      },
    };
  if (result.kind === 'not_modified')
    return {
      outcome: 'not-modified',
      ledger: {
        ...base,
        lastSuccessAt: result.fetchedAt,
        etag: result.etag ?? null,
        lastModified: result.lastModified ?? null,
        lastError: null,
        consecutiveFailures: 0,
      },
    };
  const digest =
    result.payload.kind === 'text'
      ? checksum(result.payload.body)
      : result.payload.ref.sha256;
  const outcome: FetchOutcome =
    prior.lastChecksum === digest ? 'unchanged' : 'changed';
  return {
    outcome,
    ledger: {
      ...base,
      lastSuccessAt: result.fetchedAt,
      lastChangedAt:
        outcome === 'changed' ? result.fetchedAt : prior.lastChangedAt ?? null,
      etag: result.etag ?? null,
      lastModified: result.lastModified ?? null,
      lastError: null,
      consecutiveFailures: 0,
      lastChecksum: digest,
    },
  };
}

/** Read validator hints for the next request without exposing persistence details to adapters. */
export async function readFetchLedger(
  dataSource: DataSource,
  sourceId: string,
  url: string
): Promise<Pick<FetchLedgerRow, 'etag' | 'lastModified'> | null> {
  if (!dataSource.hasMetadata(FetchLedgerSchema)) return null;
  const row = await dataSource
    .getRepository(FetchLedgerSchema)
    .findOneBy({ sourceId, url: canonicalUrl(url) });
  return row
    ? { etag: row.etag ?? null, lastModified: row.lastModified ?? null }
    : null;
}

const persistenceLocks = new WeakMap<DataSource, Promise<void>>();

function ledgerAdvisoryKey(sourceId: string, url: string): string {
  return createHash('sha256')
    .update(`${sourceId}\u0000${url}`)
    .digest()
    .readBigInt64BE(0)
    .toString();
}

/** Acquire the transaction-scoped PostgreSQL lock that serializes this key, including absent rows. */
export async function acquireLedgerKeyLock(
  manager: EntityManager,
  sourceId: string,
  url: string
): Promise<void> {
  if (manager.connection.options.type !== 'postgres') return;
  await manager.query('SELECT pg_advisory_xact_lock($1::bigint)', [
    ledgerAdvisoryKey(sourceId, canonicalUrl(url)),
  ]);
}

/** Lock the key before the first ledger read so concurrent creation is serialized on PostgreSQL. */
export async function findLedgerForUpdate(
  manager: EntityManager,
  sourceId: string,
  url: string
): Promise<FetchLedgerState | null> {
  const normalizedUrl = canonicalUrl(url);
  await acquireLedgerKeyLock(manager, sourceId, normalizedUrl);
  const ledgerRepo = manager.getRepository(FetchLedgerSchema);
  return (await ledgerRepo.findOne({
    where: { sourceId, url: normalizedUrl },
    ...(manager.connection.options.type === 'postgres'
      ? { lock: { mode: 'pessimistic_write' as const } }
      : {}),
  })) as FetchLedgerState | null;
}

export async function persistFetchResult(
  dataSource: DataSource,
  sourceId: string,
  result: FetchResult
): Promise<FetchOutcome> {
  const previous = persistenceLocks.get(dataSource) ?? Promise.resolve();
  const run = previous.then(async () => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await dataSource.transaction(async (manager) => {
          if (dataSource.options.type === 'better-sqlite3')
            await manager.query('PRAGMA busy_timeout = 5000');
          return persistFetchResultInManager(manager, sourceId, result);
        });
      } catch (error) {
        if (
          dataSource.options.type !== 'better-sqlite3' ||
          attempt >= 5 ||
          !/locked|busy/i.test(String(error))
        )
          throw error;
        await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
      }
    }
  });
  persistenceLocks.set(
    dataSource,
    run.then(
      () => undefined,
      () => undefined
    )
  );
  return run;
}

/** Attach the source-level requested/observed interval to every fetch row in a cycle. */
export interface FetchCoverageIds {
  ledgerIds?: readonly number[];
  attemptIds?: readonly number[];
}

/** Attach coverage only to rows created/observed by this fetch cycle. */
export async function persistFetchCoverage(
  dataSource: DataSource,
  sourceId: string,
  range: CoverageRange,
  ids: FetchCoverageIds = {}
): Promise<void> {
  const serialized = JSON.stringify(range);
  const observedStart = range.observedStart;
  const observedEnd = range.observedEnd;
  if (ids.ledgerIds?.length) {
    await dataSource
      .getRepository(FetchLedgerSchema)
      .update(
        { id: In(ids.ledgerIds) },
        { observedStart, observedEnd, coverageRange: serialized }
      );
  }
  if (ids.attemptIds?.length) {
    await dataSource
      .getRepository(FetchAttemptSchema)
      .update(
        { id: In(ids.attemptIds) },
        { observedStart, observedEnd, coverageRange: serialized }
      );
  }
}

/** Record a successful source cycle that emitted no durable raw records. */
export async function persistEmptyFetch(
  dataSource: DataSource,
  sourceId: string,
  url: string,
  at: string
): Promise<{ attemptId: number; ledgerId: number }> {
  const normalizedUrl = canonicalUrl(url);
  return dataSource.transaction(async (manager) => {
    const attempt = await manager
      .getRepository(FetchAttemptSchema)
      .save({
        sourceId,
        url: normalizedUrl,
        requestUrl: normalizedUrl,
        attemptedAt: at,
        status: 200,
        outcome: 'unchanged',
        etag: null,
        lastModified: null,
        errorKind: null,
        error: null,
        retryable: null,
      });
    await manager
      .getRepository(FetchLedgerSchema)
      .upsert(
        {
          sourceId,
          url: normalizedUrl,
          lastAttemptAt: at,
          lastSuccessAt: at,
          lastStatus: 200,
          lastError: null,
          consecutiveFailures: 0,
        },
        ['sourceId', 'url']
      );
    const ledger = await manager
      .getRepository(FetchLedgerSchema)
      .findOneBy({ sourceId, url: normalizedUrl });
    if (attempt.id === undefined || ledger?.id === undefined)
      throw new Error('empty fetch persistence did not return row ids');
    return { attemptId: attempt.id, ledgerId: ledger.id };
  });
}

async function persistFetchResultInManager(
  manager: EntityManager,
  sourceId: string,
  result: FetchResult
): Promise<FetchOutcome> {
  result = {
    ...result,
    url: canonicalUrl(result.url),
    requestUrl: canonicalUrl(result.requestUrl),
  };
  const ledgerRepo = manager.getRepository(FetchLedgerSchema);
  const attemptRepo = manager.getRepository(FetchAttemptSchema);
  const versionRepo = manager.getRepository(RawDocumentVersionSchema);
  const rawRepo = manager.getRepository(RawDocumentSchema);
  const previous = await findLedgerForUpdate(manager, sourceId, result.url);
  let outcome: FetchOutcome;
  let state: FetchLedgerState;
  if (result.kind === 'fetched') {
    if (result.payload.kind === 'blob-ref') validateBlobRef(result.payload.ref);
    const digest =
      result.payload.kind === 'text'
        ? checksum(result.payload.body)
        : result.payload.ref.sha256;
    const transition = nextFetchState(previous ?? undefined, result);
    outcome = transition.outcome;
    state = transition.ledger;
    if (outcome !== 'ignored-stale') state.lastChecksum = digest;
    if (outcome === 'changed') {
      let version = await versionRepo.findOneBy({
        sourceId,
        url: result.url,
        checksum: digest,
      });
      if (!version) {
        try {
          version = await versionRepo.save({
            sourceId,
            url: result.url,
            checksum: digest,
            payloadKind: result.payload.kind,
            body: result.payload.kind === 'text' ? result.payload.body : null,
            blobRef:
              result.payload.kind === 'blob-ref'
                ? JSON.stringify(result.payload.ref)
                : null,
            contentType: result.contentType,
            fetchedAt: result.fetchedAt,
          });
        } catch (error) {
          if (!/unique|constraint|duplicate/i.test(String(error))) throw error;
          version =
            (await versionRepo.findOneBy({
              sourceId,
              url: result.url,
              checksum: digest,
            })) ??
            (() => {
              throw error;
            })();
        }
      }
      const existing = await rawRepo.findOneBy({ sourceId, url: result.url });
      await rawRepo.upsert(
        {
          ...(existing ?? {}),
          sourceId,
          urlHash: checksum(`${sourceId}|${result.url}`),
          url: result.url,
          contentType: result.contentType,
          body: null,
          checksum: digest,
          fetchedAt: result.fetchedAt,
          activeVersionId: version.id,
        },
        ['sourceId', 'url']
      );
    }
  } else {
    const next = nextFetchState(previous ?? undefined, result);
    outcome = next.outcome;
    state = next.ledger;
  }
  await attemptRepo.save({
    sourceId,
    url: result.url,
    requestUrl: result.requestUrl,
    attemptedAt: result.fetchedAt,
    status: result.status,
    outcome,
    etag: result.etag ?? null,
    lastModified: result.lastModified ?? null,
    errorKind: result.kind === 'failed' ? result.error.kind : null,
    error: result.kind === 'failed' ? errorText(result) : null,
    retryable: result.kind === 'failed' ? result.error.retryable : null,
  });
  await ledgerRepo.upsert(
    {
      ...state,
      sourceId,
      url: result.url,
      lastChecksum: state.lastChecksum,
    } as FetchLedgerState,
    ['sourceId', 'url']
  );
  return outcome;
}

export async function copyLegacyQuarantine(
  dataSource: DataSource,
  legacy: {
    id: string | number;
    sourceId?: string;
    scopeSlug?: string | null;
    error?: string;
    createdAt?: string;
    payload?: string | null;
  },
  backup: { path: string; sha256: string; bytes: number }
): Promise<boolean> {
  const repo = dataSource.getRepository(FoundationQuarantineSchema);
  const targetKey = `legacy-row:${legacy.id}`;
  if (await repo.findOneBy({ targetType: 'legacy-row', targetKey }))
    return false;
  await repo.save({
    targetType: 'legacy-row',
    targetKey,
    sourceId: legacy.sourceId ?? null,
    scopeSlug: legacy.scopeSlug ?? null,
    stage: 'legacy-rebuild',
    error: legacy.error ?? '',
    retryable: false,
    payloadSha256: legacy.payload ? checksum(legacy.payload) : null,
    payloadBytes: legacy.payload ? Buffer.byteLength(legacy.payload) : null,
    payloadRef: `legacy-backup:sha256:${backup.sha256}`,
    createdAt: legacy.createdAt ?? new Date().toISOString(),
  });
  return true;
}
