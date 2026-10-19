/** Shared envelope for a single owner's transaction-consistent export stream. */
export const ACCOUNT_EXPORT_OWNER_CONTRACT_VERSION = 1 as const;
export const ACCOUNT_EXPORT_OWNER_SCHEMA_VERSION = '2026-10-19.v1' as const;

export interface AccountExportOwnerRecord<TSource extends string = string> {
  source: TSource;
  /** Includes a nonempty, lexically ordered string primary key named `id`. */
  data: Record<string, unknown>;
}

export interface AccountExportOwnerChunk<TSource extends string = string> {
  contractVersion: typeof ACCOUNT_EXPORT_OWNER_CONTRACT_VERSION;
  schemaVersion: typeof ACCOUNT_EXPORT_OWNER_SCHEMA_VERSION;
  participantId: string;
  accountId: string;
  captureId: string;
  snapshotAt: string;
  pageOrdinal: number;
  source: TSource | 'end';
  cursor: string | null;
  records: AccountExportOwnerRecord<TSource>[];
  sourceComplete: boolean;
  endOfStream: boolean;
  complete: boolean;
  rowCount?: number;
  checksum?: string;
  sourceRowCounts?: Partial<Record<TSource, number>>;
  sourceDispositions?: Partial<Record<TSource, string>>;
  uncovered?: string[];
}

export type AccountExportOwnerFailureCode =
  | 'OWNER_AUTHORIZATION_FAILED'
  | 'OWNER_ACCOUNT_MISMATCH'
  | 'OWNER_ACCOUNT_NOT_FOUND'
  | 'OWNER_RELATIONSHIP_AMBIGUOUS'
  | 'OWNER_READ_FAILED'
  | 'OWNER_CAPTURE_TIMEOUT'
  | 'OWNER_CAPTURE_ABORTED'
  | 'OWNER_STREAM_CONSUMER_FAILED';

export interface AccountExportOwnerFailure {
  contractVersion: typeof ACCOUNT_EXPORT_OWNER_CONTRACT_VERSION;
  participantId: string;
  accountId: string;
  complete: false;
  code: AccountExportOwnerFailureCode;
}

/** Shape guard only. Use AccountExportOwnerCaptureVerifier for capture proof. */
export function isCompleteAccountExportOwnerEndEnvelope(
  value: unknown
): value is AccountExportOwnerChunk {
  if (!value || typeof value !== 'object') return false;
  const chunk = value as Partial<AccountExportOwnerChunk>;
  return (
    chunk.contractVersion === ACCOUNT_EXPORT_OWNER_CONTRACT_VERSION &&
    chunk.schemaVersion === ACCOUNT_EXPORT_OWNER_SCHEMA_VERSION &&
    typeof chunk.participantId === 'string' &&
    typeof chunk.accountId === 'string' &&
    typeof chunk.captureId === 'string' &&
    typeof chunk.snapshotAt === 'string' &&
    chunk.source === 'end' &&
    chunk.endOfStream === true &&
    chunk.complete === true &&
    chunk.uncovered?.length === 0 &&
    Number.isSafeInteger(chunk.rowCount) &&
    typeof chunk.checksum === 'string' &&
    /^[a-f0-9]{64}$/.test(chunk.checksum)
  );
}

/**
 * Stateful verifier for ordered owner pages and the terminal capture proof.
 * Digest injection keeps this shared contract usable by browser clients.
 * A failed or completed verifier is terminal; callers must discard failed staging.
 */
export class AccountExportOwnerCaptureVerifier<TSource extends string> {
  private pageOrdinal = 0;
  private captureId: string | undefined;
  private snapshotAt: string | undefined;
  private sourceIndex = 0;
  private lastRecordId: string | undefined;
  private ended = false;
  private failed = false;
  private rowCount = 0;
  private readonly sourceRowCounts: Partial<Record<TSource, number>> = {};
  constructor(
    private readonly participantId: string,
    private readonly accountId: string,
    private readonly expectedSources: readonly TSource[],
    private readonly checksum: {
      update(value: string): void;
      digest(encoding: 'hex'): string;
    },
    private readonly maxPageRecords = 250,
    private readonly maxPageBytes = 512 * 1024
  ) {
    if (
      !participantId ||
      !accountId ||
      expectedSources.length === 0 ||
      expectedSources.length > 100 ||
      new Set(expectedSources).size !== expectedSources.length ||
      expectedSources.some((source) => !source || source === 'end') ||
      !Number.isSafeInteger(maxPageRecords) ||
      maxPageRecords < 1 ||
      !Number.isSafeInteger(maxPageBytes) ||
      maxPageBytes < 1
    )
      throw new Error('OWNER_CAPTURE_INVALID_CONFIGURATION');
  }

  accept(chunk: AccountExportOwnerChunk<TSource>): boolean {
    if (this.failed || this.ended) throw new Error('OWNER_CAPTURE_CLOSED');
    try {
      return this.acceptPage(chunk);
    } catch (error) {
      this.failed = true;
      throw error;
    }
  }

  private acceptPage(chunk: AccountExportOwnerChunk<TSource>): boolean {
    if (
      !chunk ||
      chunk.contractVersion !== ACCOUNT_EXPORT_OWNER_CONTRACT_VERSION ||
      chunk.schemaVersion !== ACCOUNT_EXPORT_OWNER_SCHEMA_VERSION ||
      chunk.participantId !== this.participantId ||
      chunk.accountId !== this.accountId ||
      typeof chunk.captureId !== 'string' ||
      !chunk.captureId ||
      chunk.captureId.length > 128 ||
      typeof chunk.snapshotAt !== 'string' ||
      !Number.isFinite(Date.parse(chunk.snapshotAt)) ||
      chunk.pageOrdinal !== this.pageOrdinal + 1 ||
      typeof chunk.sourceComplete !== 'boolean' ||
      typeof chunk.endOfStream !== 'boolean' ||
      typeof chunk.complete !== 'boolean' ||
      !Array.isArray(chunk.records) ||
      chunk.records.length > this.maxPageRecords ||
      new TextEncoder().encode(JSON.stringify(chunk)).length > this.maxPageBytes
    ) {
      throw new Error('OWNER_CAPTURE_INVALID_PAGE');
    }
    if (this.captureId === undefined) {
      this.captureId = chunk.captureId;
      this.snapshotAt = chunk.snapshotAt;
    } else if (
      this.captureId !== chunk.captureId ||
      this.snapshotAt !== chunk.snapshotAt
    ) {
      throw new Error('OWNER_CAPTURE_IDENTITY_CHANGED');
    }
    if (chunk.source === 'end') {
      if (
        !chunk.endOfStream ||
        !chunk.complete ||
        !chunk.sourceComplete ||
        chunk.cursor !== null ||
        chunk.records.length !== 0 ||
        !Array.isArray(chunk.uncovered) ||
        chunk.uncovered.length !== 0 ||
        this.sourceIndex !== this.expectedSources.length ||
        chunk.rowCount !== this.rowCount ||
        !Number.isSafeInteger(chunk.rowCount) ||
        !this.sameCounts(chunk.sourceRowCounts) ||
        !this.hasDispositions(chunk.sourceDispositions)
      ) {
        throw new Error('OWNER_CAPTURE_END_UNVERIFIED');
      }
      if (chunk.checksum !== this.checksum.digest('hex')) {
        throw new Error('OWNER_CAPTURE_CHECKSUM_MISMATCH');
      }
      this.pageOrdinal = chunk.pageOrdinal;
      this.ended = true;
      return true;
    }
    if (
      chunk.endOfStream ||
      chunk.complete ||
      chunk.uncovered?.length ||
      chunk.rowCount !== undefined ||
      chunk.checksum !== undefined ||
      chunk.sourceRowCounts !== undefined ||
      chunk.sourceDispositions !== undefined
    ) {
      throw new Error('OWNER_CAPTURE_INVALID_PAGE');
    }
    const expectedSource = this.expectedSources[this.sourceIndex];
    if (!expectedSource || chunk.source !== expectedSource) {
      throw new Error('OWNER_CAPTURE_SOURCE_ORDER_INVALID');
    }
    if (
      chunk.records.some(
        (record) =>
          !record ||
          record.source !== expectedSource ||
          !record.data ||
          typeof record.data !== 'object' ||
          Array.isArray(record.data)
      )
    ) {
      throw new Error('OWNER_CAPTURE_SOURCE_MISMATCH');
    }
    for (const record of chunk.records) {
      const recordId = record.data['id'];
      if (
        typeof recordId !== 'string' ||
        !recordId ||
        (this.lastRecordId !== undefined && recordId <= this.lastRecordId)
      ) {
        throw new Error('OWNER_CAPTURE_CURSOR_INVALID');
      }
      this.lastRecordId = recordId;
      const serialized = JSON.stringify(record);
      if (
        !serialized ||
        new TextEncoder().encode(serialized).length > this.maxPageBytes
      ) {
        throw new Error('OWNER_CAPTURE_RECORD_INVALID');
      }
      this.assertAccountBinding(record.data);
      this.checksum.update(`${serialized}\n`);
    }
    if (
      chunk.records.length === 0
        ? !chunk.sourceComplete ||
          chunk.cursor !== null ||
          this.lastRecordId !== undefined
        : chunk.cursor !== this.lastRecordId
    ) {
      throw new Error('OWNER_CAPTURE_CURSOR_INVALID');
    }
    this.rowCount += chunk.records.length;
    if (!Number.isSafeInteger(this.rowCount))
      throw new Error('OWNER_CAPTURE_COUNT_INVALID');
    this.sourceRowCounts[expectedSource] =
      (this.sourceRowCounts[expectedSource] ?? 0) + chunk.records.length;
    if (chunk.sourceComplete) {
      this.sourceIndex++;
      this.lastRecordId = undefined;
    }
    this.pageOrdinal = chunk.pageOrdinal;
    return false;
  }

  private assertAccountBinding(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((item) => this.assertAccountBinding(item));
      return;
    }
    for (const [key, item] of Object.entries(value)) {
      if (
        (key === 'accountId' || key === 'userId' || key === 'guardianUserId') &&
        item != null &&
        item !== this.accountId
      ) {
        throw new Error('OWNER_CAPTURE_FOREIGN_ACCOUNT');
      }
      this.assertAccountBinding(item);
    }
  }

  private sameCounts(actual?: Partial<Record<TSource, number>>): boolean {
    if (!actual || Object.keys(actual).length !== this.expectedSources.length)
      return false;
    return this.expectedSources.every(
      (source) => actual[source] === (this.sourceRowCounts[source] ?? 0)
    );
  }

  private hasDispositions(actual?: Partial<Record<TSource, string>>): boolean {
    return Boolean(
      actual &&
        Object.keys(actual).length === this.expectedSources.length &&
        this.expectedSources.every(
          (source) =>
            typeof actual[source] === 'string' &&
            actual[source]!.length > 0 &&
            actual[source]!.length <= 4096
        )
    );
  }
}
