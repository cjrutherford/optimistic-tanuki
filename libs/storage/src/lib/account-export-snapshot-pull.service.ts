import { createHash } from 'node:crypto';
import {
  ACCOUNT_EXPORT_SNAPSHOT_LIMITS,
  AccountExportSnapshotDescriptor,
  AccountExportSnapshotReadResult,
  AccountExportOwnerChunk,
} from '@optimistic-tanuki/models';
import {
  AccountExportOwnerSpoolService,
  OwnerSpoolHandle,
} from './account-export-owner-spool.service';

export type SnapshotPullCode =
  | 'SNAPSHOT_PULL_INVALID'
  | 'SNAPSHOT_PULL_READ_FAILED'
  | 'SNAPSHOT_PULL_INVALID_DATA';
export class AccountExportSnapshotPullError extends Error {
  constructor(readonly code: SnapshotPullCode) {
    super(code);
    this.name = 'AccountExportSnapshotPullError';
  }
}

export interface AccountExportSnapshotPullOptions<TSource extends string> {
  participantId: string;
  accountId: string;
  sources: readonly TSource[];
  snapshot: AccountExportSnapshotDescriptor;
  read: (
    offset: number,
    length: number,
    signal: AbortSignal
  ) => Promise<AccountExportSnapshotReadResult>;
  signal?: AbortSignal;
}

/** Pulls a bounded remote snapshot into the verified owner spool. */
export class AccountExportSnapshotPullService {
  constructor(private readonly spool: AccountExportOwnerSpoolService) {}

  async capture<TSource extends string>(
    options: AccountExportSnapshotPullOptions<TSource>
  ): Promise<OwnerSpoolHandle<TSource>> {
    let participantId: string,
      accountId: string,
      sources: TSource[],
      snapshot: AccountExportSnapshotDescriptor,
      read: AccountExportSnapshotPullOptions<TSource>['read'],
      externalSignal: AbortSignal | undefined;
    try {
      participantId = options.participantId;
      accountId = options.accountId;
      sources = [...options.sources];
      snapshot = JSON.parse(
        JSON.stringify(options.snapshot)
      ) as AccountExportSnapshotDescriptor;
      read = options.read;
      externalSignal = options.signal;
      this.validateDescriptor(snapshot, participantId, accountId, sources);
    } catch {
      throw new AccountExportSnapshotPullError('SNAPSHOT_PULL_INVALID');
    }

    return this.spool.capture(
      {
        participantId,
        accountId,
        sources,
        maxBytes: ACCOUNT_EXPORT_SNAPSHOT_LIMITS.captureBytes,
        signal: externalSignal,
      },
      async (onChunk, signal) => {
        const hash = createHash('sha256');
        let offset = 0;
        let pending = Buffer.alloc(0);
        let terminal: AccountExportOwnerChunk<TSource> | undefined;
        const feedLine = async (line: Buffer): Promise<void> => {
          if (!line.length || terminal)
            throw new AccountExportSnapshotPullError(
              'SNAPSHOT_PULL_INVALID_DATA'
            );
          let chunk: AccountExportOwnerChunk<TSource>;
          try {
            chunk = JSON.parse(
              new TextDecoder('utf-8', { fatal: true }).decode(line)
            );
          } catch {
            throw new AccountExportSnapshotPullError(
              'SNAPSHOT_PULL_INVALID_DATA'
            );
          }
          if (
            !chunk ||
            typeof chunk !== 'object' ||
            chunk.captureId !== snapshot.captureId ||
            chunk.snapshotAt !== snapshot.snapshotAt ||
            chunk.participantId !== participantId ||
            chunk.accountId !== accountId
          )
            throw new AccountExportSnapshotPullError(
              'SNAPSHOT_PULL_INVALID_DATA'
            );
          if (chunk.source === 'end') {
            if (
              chunk.rowCount !== snapshot.rowCount ||
              !sameObject(chunk.sourceRowCounts, snapshot.sourceRowCounts) ||
              !sameObject(chunk.sourceDispositions, snapshot.sourceDispositions)
            )
              throw new AccountExportSnapshotPullError(
                'SNAPSHOT_PULL_INVALID_DATA'
              );
            terminal = chunk;
          }
          await onChunk(chunk);
        };
        try {
          while (offset < snapshot.sizeBytes) {
            const length = Math.min(
              ACCOUNT_EXPORT_SNAPSHOT_LIMITS.readBytes,
              snapshot.sizeBytes - offset
            );
            const response = await read(offset, length, signal);
            if (
              !response ||
              response.handleId !== snapshot.handleId ||
              response.captureId !== snapshot.captureId ||
              response.offset !== offset ||
              typeof response.bytesBase64 !== 'string' ||
              response.bytesBase64.length > Math.ceil(length / 3) * 4 ||
              !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
                response.bytesBase64
              )
            )
              throw new AccountExportSnapshotPullError(
                'SNAPSHOT_PULL_READ_FAILED'
              );
            const bytes = Buffer.from(response.bytesBase64, 'base64');
            if (
              bytes.toString('base64') !== response.bytesBase64 ||
              bytes.length !== length ||
              response.eof !== (offset + length === snapshot.sizeBytes)
            )
              throw new AccountExportSnapshotPullError(
                'SNAPSHOT_PULL_READ_FAILED'
              );
            hash.update(bytes);
            offset += bytes.length;
            let start = 0;
            while (start < bytes.length) {
              const newline = bytes.indexOf(10, start);
              const end = newline < 0 ? bytes.length : newline;
              const fragment = bytes.subarray(start, end);
              if (
                pending.length + fragment.length >
                ACCOUNT_EXPORT_SNAPSHOT_LIMITS.lineBytes
              )
                throw new AccountExportSnapshotPullError(
                  'SNAPSHOT_PULL_INVALID_DATA'
                );
              pending = pending.length
                ? Buffer.concat([pending, fragment])
                : fragment;
              if (newline < 0) break;
              await feedLine(pending);
              pending = Buffer.alloc(0);
              start = newline + 1;
            }
          }
          if (
            pending.length ||
            hash.digest('hex') !== snapshot.sha256 ||
            !terminal
          )
            throw new AccountExportSnapshotPullError(
              'SNAPSHOT_PULL_INVALID_DATA'
            );
          return terminal;
        } catch (error) {
          if (error instanceof AccountExportSnapshotPullError) throw error;
          throw new AccountExportSnapshotPullError('SNAPSHOT_PULL_READ_FAILED');
        }
      }
    );
  }

  private validateDescriptor<TSource extends string>(
    d: AccountExportSnapshotDescriptor,
    participantId: string,
    accountId: string,
    sources: TSource[]
  ): void {
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    // Preserve the owner-provided PostgreSQL timestamp text (including timezone
    // spelling and fractional precision); parsing is only a validity check.
    const boundedTimestamp = (v: string) =>
      typeof v === 'string' && v.length <= 64 && Number.isFinite(Date.parse(v));
    const countMap = (v: Record<string, number>) =>
      v &&
      Object.keys(v).length === sources.length &&
      Object.keys(v).every((k) => sources.includes(k as TSource)) &&
      sources.every((s) => Number.isSafeInteger(v[s]) && v[s] >= 0);
    const dispositionMap = (v: Record<string, string>) =>
      v &&
      Object.keys(v).length === sources.length &&
      Object.keys(v).every((k) => sources.includes(k as TSource)) &&
      sources.every(
        (s) =>
          typeof v[s] === 'string' && v[s].length > 0 && v[s].length <= 4096
      );
    const allowed = [
      'handleId',
      'participantId',
      'accountId',
      'captureId',
      'snapshotAt',
      'sizeBytes',
      'sha256',
      'rowCount',
      'sources',
      'sourceRowCounts',
      'sourceDispositions',
      'identityCount',
      'expiresAt',
    ];
    if (
      !d ||
      Object.keys(d).some((k) => !allowed.includes(k)) ||
      d.participantId !== participantId ||
      d.accountId !== accountId ||
      !uuid.test(d.handleId) ||
      !uuid.test(d.captureId) ||
      !boundedTimestamp(d.snapshotAt) ||
      !boundedTimestamp(d.expiresAt) ||
      Date.parse(d.expiresAt) <= Date.parse(d.snapshotAt) ||
      d.sources.length !== sources.length ||
      d.sources.some((s, i) => s !== sources[i]) ||
      !Number.isSafeInteger(d.sizeBytes) ||
      d.sizeBytes < 1 ||
      d.sizeBytes > ACCOUNT_EXPORT_SNAPSHOT_LIMITS.captureBytes ||
      !/^[a-f0-9]{64}$/i.test(d.sha256) ||
      !Number.isSafeInteger(d.rowCount) ||
      d.rowCount < 0 ||
      !countMap(d.sourceRowCounts) ||
      !dispositionMap(d.sourceDispositions) ||
      Object.values(d.sourceRowCounts).reduce((a, b) => a + b, 0) !==
        d.rowCount ||
      !Number.isSafeInteger(d.identityCount) ||
      d.identityCount < 0 ||
      (Number.isSafeInteger(d.sourceRowCounts['profileIdentity']) &&
        d.identityCount !== d.sourceRowCounts['profileIdentity']) ||
      Object.keys(d).length !== allowed.length
    )
      throw new AccountExportSnapshotPullError('SNAPSHOT_PULL_INVALID');
  }
}
function sameObject(a: unknown, b: unknown): boolean {
  if (
    !a ||
    !b ||
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    Array.isArray(a) ||
    Array.isArray(b)
  )
    return false;
  const aa = a as Record<string, unknown>,
    bb = b as Record<string, unknown>;
  return (
    Object.keys(aa).length === Object.keys(bb).length &&
    Object.keys(bb).every((k) => aa[k] === bb[k])
  );
}
