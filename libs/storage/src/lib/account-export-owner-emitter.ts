import { createHash, Hash } from 'node:crypto';
import {
  AccountExportOwnerChunk,
  AccountExportOwnerRecord,
  ACCOUNT_EXPORT_OWNER_CONTRACT_VERSION,
  ACCOUNT_EXPORT_OWNER_SCHEMA_VERSION,
} from '@optimistic-tanuki/models';

export interface AccountExportOwnerEmitterOptions<TSource extends string> {
  participantId: string;
  accountId: string;
  captureId: string;
  snapshotAt: string;
  sources: readonly TSource[];
  maxPageRecords?: number;
  maxPageBytes?: number;
  signal?: AbortSignal;
}

export type AccountExportOwnerSourceStreams<TSource extends string> = {
  [Source in TSource]: () => AsyncIterable<AccountExportOwnerRecord<TSource>>;
};

export class AccountExportOwnerEmitterError extends Error {
  constructor(
    readonly code:
      | 'OWNER_CAPTURE_ABORTED'
      | 'OWNER_CAPTURE_INVALID_CONFIGURATION'
      | 'OWNER_CAPTURE_INVALID_RECORD'
      | 'OWNER_CAPTURE_RECORD_TOO_LARGE'
      | 'OWNER_STREAM_CONSUMER_FAILED'
      | 'OWNER_CAPTURE_SOURCE_INCOMPLETE'
  ) {
    super(code);
    this.name = 'AccountExportOwnerEmitterError';
  }
}

/** Bounded source paging shared by backend owner captures. */
export class AccountExportOwnerEmitter<TSource extends string> {
  private readonly options: AccountExportOwnerEmitterOptions<TSource>;
  private readonly onChunk: (
    chunk: AccountExportOwnerChunk<TSource>,
    signal?: AbortSignal
  ) => Promise<void>;
  private readonly maxPageRecords: number;
  private readonly maxPageBytes: number;
  private readonly checksum: Hash = createHash('sha256');
  private readonly sourceRowCounts: Partial<Record<TSource, number>> = {};
  private readonly sourceDispositions: Partial<Record<TSource, string>> = {};
  private pageOrdinal = 0;
  private rowCount = 0;
  private sourceIndex = 0;
  private completed = false;
  private failed = false;

  constructor(
    options: AccountExportOwnerEmitterOptions<TSource>,
    onChunk: (
      chunk: AccountExportOwnerChunk<TSource>,
      signal?: AbortSignal
    ) => Promise<void>
  ) {
    this.options = { ...options, sources: [...options.sources] };
    this.onChunk = onChunk;
    this.maxPageRecords = options.maxPageRecords ?? 250;
    this.maxPageBytes = options.maxPageBytes ?? 512 * 1024;
    if (
      !options.participantId ||
      !options.accountId ||
      !options.captureId ||
      !Number.isFinite(Date.parse(options.snapshotAt)) ||
      options.sources.length === 0 ||
      options.sources.length > 100 ||
      new Set(options.sources).size !== options.sources.length ||
      options.sources.some((source) => !source || source === 'end') ||
      !Number.isSafeInteger(this.maxPageRecords) ||
      this.maxPageRecords < 1 ||
      !Number.isSafeInteger(this.maxPageBytes) ||
      this.maxPageBytes < 1 ||
      typeof onChunk !== 'function'
    ) {
      throw new AccountExportOwnerEmitterError(
        'OWNER_CAPTURE_INVALID_CONFIGURATION'
      );
    }
  }

  async emitSources(
    streams: AccountExportOwnerSourceStreams<TSource>
  ): Promise<void> {
    if (this.failed || this.completed || this.sourceIndex !== 0) {
      throw new AccountExportOwnerEmitterError(
        'OWNER_CAPTURE_SOURCE_INCOMPLETE'
      );
    }
    try {
      const streamKeys = Object.keys(streams).sort();
      const expectedKeys = [...this.options.sources].sort();
      if (JSON.stringify(streamKeys) !== JSON.stringify(expectedKeys)) {
        throw new AccountExportOwnerEmitterError(
          'OWNER_CAPTURE_SOURCE_INCOMPLETE'
        );
      }
      for (const source of this.options.sources) {
        this.assertActive();
        const factory = streams[source];
        if (typeof factory !== 'function') {
          throw new AccountExportOwnerEmitterError(
            'OWNER_CAPTURE_SOURCE_INCOMPLETE'
          );
        }
        await this.emitSource(source, factory());
        this.sourceIndex++;
      }
    } catch (error) {
      this.failed = true;
      throw error;
    }
  }

  async complete(
    dispositions?: Partial<Record<TSource, string>>
  ): Promise<AccountExportOwnerChunk<TSource>> {
    this.assertActive();
    if (this.sourceIndex !== this.options.sources.length) {
      this.failed = true;
      throw new AccountExportOwnerEmitterError(
        'OWNER_CAPTURE_SOURCE_INCOMPLETE'
      );
    }
    for (const source of this.options.sources) {
      const disposition = dispositions?.[source];
      this.sourceDispositions[source] =
        typeof disposition === 'string' && disposition.length > 0
          ? disposition
          : (this.sourceRowCounts[source] ?? 0) > 0
          ? 'retained'
          : 'no-retained-rows';
    }
    const end: AccountExportOwnerChunk<TSource> = {
      ...this.identity(),
      pageOrdinal: ++this.pageOrdinal,
      source: 'end',
      cursor: null,
      records: [],
      sourceComplete: true,
      endOfStream: true,
      complete: true,
      rowCount: this.rowCount,
      checksum: this.checksum.digest('hex'),
      sourceRowCounts: { ...this.sourceRowCounts },
      sourceDispositions: { ...this.sourceDispositions },
      uncovered: [],
    };
    await this.deliver(end);
    this.completed = true;
    return end;
  }

  private async emitSource(
    source: TSource,
    iterable: AsyncIterable<AccountExportOwnerRecord<TSource>>
  ): Promise<void> {
    const iterator = iterable[Symbol.asyncIterator]();
    let previousId: string | undefined;
    let sourceCount = 0;
    let exhausted = false;
    try {
      let pending = await iterator.next();
      if (pending.done) {
        exhausted = true;
        await this.emitPage(source, [], null, true);
        this.sourceRowCounts[source] = 0;
        this.sourceDispositions[source] = 'no-retained-rows';
        return;
      }
      while (true) {
        this.assertActive();
        const records: AccountExportOwnerRecord<TSource>[] = [];
        let pageId: string | null = null;
        while (!pending.done && records.length < this.maxPageRecords) {
          const record = pending.value;
          const id = this.validateRecord(record, source, previousId);
          const candidate = [...records, record];
          const candidateChunk = this.page(source, candidate, id, false);
          if (this.byteLength(candidateChunk) > this.maxPageBytes) {
            if (records.length === 0) {
              throw new AccountExportOwnerEmitterError(
                'OWNER_CAPTURE_RECORD_TOO_LARGE'
              );
            }
            break;
          }
          records.push(record);
          pageId = id;
          previousId = id;
          sourceCount++;
          this.rowCount++;
          if (!Number.isSafeInteger(this.rowCount)) {
            throw new AccountExportOwnerEmitterError(
              'OWNER_CAPTURE_INVALID_RECORD'
            );
          }
          this.checksum.update(`${JSON.stringify(record)}\n`);
          pending = await iterator.next();
        }
        const sourceComplete = pending.done === true;
        if (sourceComplete) exhausted = true;
        await this.emitPage(source, records, pageId, sourceComplete);
        if (sourceComplete) break;
      }
      this.sourceRowCounts[source] = sourceCount;
      this.sourceDispositions[source] = 'retained';
    } finally {
      if (!exhausted && iterator.return) {
        try {
          await iterator.return();
        } catch {
          // Preserve the capture failure; callers discard the staged stream.
        }
      }
    }
  }

  private validateRecord(
    record: AccountExportOwnerRecord<TSource>,
    source: TSource,
    previousId?: string
  ): string {
    if (
      !record ||
      record.source !== source ||
      !record.data ||
      typeof record.data !== 'object' ||
      Array.isArray(record.data) ||
      typeof record.data['id'] !== 'string' ||
      !record.data['id'] ||
      (previousId !== undefined && record.data['id'] <= previousId)
    ) {
      throw new AccountExportOwnerEmitterError('OWNER_CAPTURE_INVALID_RECORD');
    }
    const serialized = JSON.stringify(record);
    if (!serialized) {
      throw new AccountExportOwnerEmitterError('OWNER_CAPTURE_INVALID_RECORD');
    }
    return record.data['id'];
  }

  private async emitPage(
    source: TSource,
    records: AccountExportOwnerRecord<TSource>[],
    cursor: string | null,
    sourceComplete: boolean
  ): Promise<void> {
    await this.deliver(this.page(source, records, cursor, sourceComplete));
  }

  private page(
    source: TSource,
    records: AccountExportOwnerRecord<TSource>[],
    cursor: string | null,
    sourceComplete: boolean
  ): AccountExportOwnerChunk<TSource> {
    return {
      ...this.identity(),
      pageOrdinal: this.pageOrdinal + 1,
      source,
      cursor,
      records,
      sourceComplete,
      endOfStream: false,
      complete: false,
    };
  }

  private identity(): Pick<
    AccountExportOwnerChunk<TSource>,
    | 'contractVersion'
    | 'schemaVersion'
    | 'participantId'
    | 'accountId'
    | 'captureId'
    | 'snapshotAt'
  > {
    return {
      contractVersion: ACCOUNT_EXPORT_OWNER_CONTRACT_VERSION,
      schemaVersion: ACCOUNT_EXPORT_OWNER_SCHEMA_VERSION,
      participantId: this.options.participantId,
      accountId: this.options.accountId,
      captureId: this.options.captureId,
      snapshotAt: this.options.snapshotAt,
    };
  }

  private byteLength(chunk: AccountExportOwnerChunk<TSource>): number {
    return new TextEncoder().encode(JSON.stringify(chunk)).length;
  }

  private async deliver(
    chunk: AccountExportOwnerChunk<TSource>
  ): Promise<void> {
    this.assertActive();
    if (this.byteLength(chunk) > this.maxPageBytes) {
      throw new AccountExportOwnerEmitterError(
        'OWNER_CAPTURE_RECORD_TOO_LARGE'
      );
    }
    try {
      await this.onChunk(chunk, this.options.signal);
    } catch {
      this.failed = true;
      throw new AccountExportOwnerEmitterError('OWNER_STREAM_CONSUMER_FAILED');
    }
    this.assertActive();
    this.pageOrdinal = chunk.pageOrdinal;
  }

  getSourceRowCount(source: TSource): number | undefined {
    return this.sourceRowCounts[source];
  }

  private assertActive(): void {
    if (this.failed || this.completed) {
      throw new AccountExportOwnerEmitterError(
        'OWNER_CAPTURE_SOURCE_INCOMPLETE'
      );
    }
    if (this.options.signal?.aborted) {
      this.failed = true;
      throw new AccountExportOwnerEmitterError('OWNER_CAPTURE_ABORTED');
    }
  }
}
