import { In, type DataSource } from 'typeorm';
import {
  CivicItemSchema,
  FetchAttemptSchema,
  FetchLedgerSchema,
  RawDocumentSchema,
  RawDocumentVersionSchema,
  type CivicItemRow,
  type FetchAttemptRow,
  type FetchLedgerRow,
  type RawDocumentRow,
  type RawDocumentVersionRow,
} from './schema.js';

export type SourceFreshnessBasis =
  | 'observed'
  | 'fetched-fallback'
  | 'unavailable';

export interface SourceFreshness {
  sourceKey: string;
  observedAt?: string | null;
  fetchedAt?: string | null;
  basis: SourceFreshnessBasis;
}

export interface FreshnessRows {
  rawDocuments: Pick<RawDocumentRow, 'id' | 'sourceId' | 'fetchedAt'>[];
  rawVersions: Pick<RawDocumentVersionRow, 'id' | 'sourceId' | 'fetchedAt'>[];
  fetchAttempts: Pick<FetchAttemptRow, 'id' | 'sourceId' | 'attemptedAt'>[];
  ledgers: Pick<
    FetchLedgerRow,
    'id' | 'sourceId' | 'lastSuccessAt' | 'lastAttemptAt'
  >[];
}

export interface FreshnessScope {
  /** IDs emitted by this run; no prior/global rows are eligible as fallback. */
  currentItemIds: readonly number[];
  currentRawDocumentIds: readonly number[];
  currentRawVersionIds: readonly number[];
  currentFetchAttemptIds: readonly number[];
  currentLedgerIds: readonly number[];
}

function latest(values: (string | null | undefined)[]): string | null {
  const valid = values.filter(
    (value): value is string =>
      typeof value === 'string' && Number.isFinite(Date.parse(value))
  );
  return (
    valid.sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null
  );
}

/**
 * Derive source freshness only from current item/run rows. An observed item
 * date remains authoritative; fetch timestamps are explicitly a fallback and
 * are never silently presented as an observation date.
 */
export function deriveSourceFreshnessFromRows(
  items: Pick<CivicItemRow, 'id' | 'sourceId' | 'observedAt'>[],
  rows: FreshnessRows,
  scope: FreshnessScope
): SourceFreshness[] {
  const currentItems = new Set(scope.currentItemIds);
  const sources = [
    ...new Set(
      items
        .filter((item) => item.id !== undefined && currentItems.has(item.id))
        .map((item) => item.sourceId)
    ),
  ];
  return sources.map((sourceKey) => {
    const sourceItems = items.filter(
      (item) =>
        item.sourceId === sourceKey &&
        item.id !== undefined &&
        currentItems.has(item.id)
    );
    const observedAt = latest(sourceItems.map((item) => item.observedAt));
    if (observedAt)
      return {
        sourceKey,
        observedAt,
        fetchedAt: null,
        basis: 'observed' as const,
      };
    const current = <T extends { id?: number; sourceId: string }>(
      values: T[],
      ids: readonly number[]
    ) => {
      const allowed = new Set(ids);
      return values.filter(
        (value) =>
          value.id !== undefined &&
          allowed.has(value.id) &&
          value.sourceId === sourceKey
      );
    };
    const fetchedAt = latest([
      ...current(rows.rawVersions, scope.currentRawVersionIds).map(
        (row) => row.fetchedAt
      ),
      ...current(rows.rawDocuments, scope.currentRawDocumentIds).map(
        (row) => row.fetchedAt
      ),
      ...current(rows.ledgers, scope.currentLedgerIds).flatMap((row) => [
        row.lastSuccessAt,
        row.lastAttemptAt,
      ]),
      ...current(rows.fetchAttempts, scope.currentFetchAttemptIds).map(
        (row) => row.attemptedAt
      ),
    ]);
    return fetchedAt
      ? {
          sourceKey,
          observedAt: null,
          fetchedAt,
          basis: 'fetched-fallback' as const,
        }
      : {
          sourceKey,
          observedAt: null,
          fetchedAt: null,
          basis: 'unavailable' as const,
        };
  });
}

/** Query the current run's explicitly emitted row IDs, then apply the pure derivation. */
export async function deriveSourceFreshness(
  ds: DataSource,
  items: Pick<CivicItemRow, 'id' | 'sourceId' | 'observedAt'>[],
  scope: FreshnessScope
): Promise<SourceFreshness[]> {
  const findByIds = async <T>(
    schema: Parameters<DataSource['getRepository']>[0],
    ids: readonly number[]
  ): Promise<T[]> =>
    ids.length
      ? (ds.getRepository(schema).find({ where: { id: In(ids) } }) as Promise<
          T[]
        >)
      : [];
  const [rawDocuments, rawVersions, fetchAttempts, ledgers] = await Promise.all(
    [
      findByIds<RawDocumentRow>(RawDocumentSchema, scope.currentRawDocumentIds),
      findByIds<RawDocumentVersionRow>(
        RawDocumentVersionSchema,
        scope.currentRawVersionIds
      ),
      findByIds<FetchAttemptRow>(
        FetchAttemptSchema,
        scope.currentFetchAttemptIds
      ),
      findByIds<FetchLedgerRow>(FetchLedgerSchema, scope.currentLedgerIds),
    ]
  );
  return deriveSourceFreshnessFromRows(
    items,
    { rawDocuments, rawVersions, fetchAttempts, ledgers },
    scope
  );
}

/** Load current persisted items when callers only have IDs from the run. */
export async function deriveSourceFreshnessForItemIds(
  ds: DataSource,
  scope: FreshnessScope
): Promise<SourceFreshness[]> {
  const items = scope.currentItemIds.length
    ? await ds.getRepository(CivicItemSchema).find({
        where: { id: In(scope.currentItemIds) },
        // Source order in the result follows item order; pin it to insertion order.
        order: { id: 'ASC' },
      })
    : [];
  return deriveSourceFreshness(ds, items, scope);
}
