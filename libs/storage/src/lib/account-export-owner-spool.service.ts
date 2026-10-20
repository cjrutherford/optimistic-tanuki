import { createHash, randomBytes } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { chmod, mkdir, mkdtemp, open, rmdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import {
  AccountExportOwnerCaptureVerifier,
  AccountExportOwnerChunk,
} from '@optimistic-tanuki/models';

const DEFAULT_CAPTURE_BYTES = 256 * 1024 * 1024;
const DEFAULT_CAPTURE_TIMEOUT_MS = 45_000;
const MAX_READ_CHUNK_BYTES = 64 * 1024;

export type OwnerSpoolFailureCode =
  | 'OWNER_SPOOL_ABORTED'
  | 'OWNER_SPOOL_TIMEOUT'
  | 'OWNER_SPOOL_INVALID_CAPTURE'
  | 'OWNER_SPOOL_INCOMPLETE_CAPTURE'
  | 'OWNER_SPOOL_CONCURRENT_CALLBACK'
  | 'OWNER_SPOOL_BYTE_LIMIT'
  | 'OWNER_SPOOL_IO_FAILED'
  | 'OWNER_SPOOL_CLOSED'
  | 'OWNER_SPOOL_INVALID_RANGE';

export class OwnerSpoolError extends Error {
  constructor(readonly code: OwnerSpoolFailureCode) {
    super(code);
    this.name = 'OwnerSpoolError';
  }
}

export interface OwnerSpoolOptions<TSource extends string> {
  participantId: string;
  accountId: string;
  sources: readonly TSource[];
  maxBytes?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  spoolRoot?: string;
}

export interface OwnerSpoolMetadata<TSource extends string> {
  participantId: string;
  accountId: string;
  captureId: string;
  snapshotAt: string;
  sizeBytes: number;
  sha256: string;
  rowCount: number;
  sourceRowCounts: Partial<Record<TSource, number>>;
  sourceDispositions: Partial<Record<TSource, string>>;
}

export interface OwnerSpoolHandle<TSource extends string> {
  readonly metadata: Readonly<OwnerSpoolMetadata<TSource>>;
  createReadStream(start?: number, endExclusive?: number): Readable;
  readChunk(offset: number, length: number): Promise<Buffer>;
  cleanup(): Promise<void>;
}

export type OwnerChunkConsumer<TSource extends string> = (
  chunk: AccountExportOwnerChunk<TSource>
) => Promise<void>;

/**
 * Verifies and stages one owner's stream in an unlinked, process-held file.
 * Only a complete producer return with a matching terminal chunk releases a read handle.
 */
export class AccountExportOwnerSpoolService {
  async capture<TSource extends string>(
    options: OwnerSpoolOptions<TSource>,
    producer: (
      onChunk: OwnerChunkConsumer<TSource>,
      signal: AbortSignal
    ) => Promise<AccountExportOwnerChunk<TSource>>
  ): Promise<OwnerSpoolHandle<TSource>> {
    if (!options || typeof options !== 'object') {
      throw new OwnerSpoolError('OWNER_SPOOL_INVALID_CAPTURE');
    }
    const maxBytes = options.maxBytes ?? DEFAULT_CAPTURE_BYTES;
    const timeoutMs = options.timeoutMs ?? DEFAULT_CAPTURE_TIMEOUT_MS;
    if (
      typeof options.participantId !== 'string' ||
      !options.participantId ||
      typeof options.accountId !== 'string' ||
      !options.accountId ||
      !Array.isArray(options.sources) ||
      options.sources.length === 0 ||
      options.sources.length > 100 ||
      options.sources.some(
        (source) => typeof source !== 'string' || !source || source === 'end'
      ) ||
      new Set(options.sources).size !== options.sources.length ||
      !Number.isSafeInteger(maxBytes) ||
      maxBytes < 1 ||
      !Number.isSafeInteger(timeoutMs) ||
      timeoutMs < 1 ||
      typeof producer !== 'function'
    )
      throw new OwnerSpoolError('OWNER_SPOOL_INVALID_CAPTURE');

    // Capture trusted configuration before invoking a producer with mutable inputs.
    options = { ...options, sources: [...options.sources] };

    const controller = new AbortController();
    const hash = createHash('sha256');
    const verifier = new AccountExportOwnerCaptureVerifier(
      options.participantId,
      options.accountId,
      options.sources,
      createHash('sha256')
    );
    let directory: string | undefined;
    let filePath: string | undefined;
    let fileHandle: Awaited<ReturnType<typeof open>> | undefined;
    let fileUnlinked = false;
    let directoryRemoved = false;
    let acceptedBytes = 0;
    let position = 0;
    let accepting = true;
    let callbackActive = false;
    let pendingCallback: Promise<void> | undefined;
    let failed = false;
    let terminal: AccountExportOwnerChunk<TSource> | undefined;
    let verifiedEnd = false;
    let producerPromise: Promise<AccountExportOwnerChunk<TSource>> | undefined;
    let timer: NodeJS.Timeout | undefined;
    let abortListener: (() => void) | undefined;
    let timeoutReject: ((error: Error) => void) | undefined;
    let externalAbortReject: ((error: Error) => void) | undefined;

    const checkActive = (): void => {
      if (failed || !accepting) throw new OwnerSpoolError('OWNER_SPOOL_CLOSED');
      if (controller.signal.aborted) throw abortReason();
    };
    const abortReason = (): OwnerSpoolError =>
      options.signal?.aborted
        ? new OwnerSpoolError('OWNER_SPOOL_ABORTED')
        : new OwnerSpoolError('OWNER_SPOOL_TIMEOUT');

    try {
      if (options.signal?.aborted)
        throw new OwnerSpoolError('OWNER_SPOOL_ABORTED');
      const spoolRoot = options.spoolRoot ?? tmpdir();
      await mkdir(spoolRoot, { recursive: true, mode: 0o700 });
      directory = await mkdtemp(join(spoolRoot, 'ot-owner-spool-'));
      await chmod(directory, 0o700);
      filePath = join(
        directory,
        `capture-${randomBytes(16).toString('hex')}.stage`
      );
      fileHandle = await open(
        filePath,
        fsConstants.O_RDWR | fsConstants.O_CREAT | fsConstants.O_EXCL,
        0o600
      );
      await fileHandle.chmod(0o600);
      await unlink(filePath);
      fileUnlinked = true;
      filePath = undefined;
      await rmdir(directory);
      directoryRemoved = true;
      directory = undefined;

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutReject = reject;
      });
      const externalAbortPromise = new Promise<never>((_, reject) => {
        externalAbortReject = reject;
      });
      timer = setTimeout(() => {
        controller.abort();
        timeoutReject?.(new OwnerSpoolError('OWNER_SPOOL_TIMEOUT'));
      }, timeoutMs);
      timer.unref?.();
      abortListener = () => {
        controller.abort();
        externalAbortReject?.(new OwnerSpoolError('OWNER_SPOOL_ABORTED'));
      };
      options.signal?.addEventListener('abort', abortListener, { once: true });
      if (options.signal?.aborted) abortListener();

      const onChunk: OwnerChunkConsumer<TSource> = (chunk) => {
        if (callbackActive) {
          failed = true;
          return Promise.reject(
            new OwnerSpoolError('OWNER_SPOOL_CONCURRENT_CALLBACK')
          );
        }
        try {
          checkActive();
        } catch (error) {
          return Promise.reject(error);
        }
        callbackActive = true;
        const operation = (async (): Promise<void> => {
          try {
            let isEnd: boolean;
            try {
              isEnd = verifier.accept(chunk);
            } catch {
              throw new OwnerSpoolError('OWNER_SPOOL_INVALID_CAPTURE');
            }
            if (isEnd) {
              terminal = JSON.parse(
                JSON.stringify(chunk)
              ) as AccountExportOwnerChunk<TSource>;
              verifiedEnd = true;
            }
            const encoded = Buffer.from(`${JSON.stringify(chunk)}\n`, 'utf8');
            if (acceptedBytes + encoded.length > maxBytes) {
              failed = true;
              throw new OwnerSpoolError('OWNER_SPOOL_BYTE_LIMIT');
            }
            let offset = 0;
            while (offset < encoded.length) {
              checkActive();
              let bytesWritten: number;
              try {
                ({ bytesWritten } = await fileHandle!.write(
                  encoded,
                  offset,
                  encoded.length - offset,
                  position
                ));
              } catch {
                throw new OwnerSpoolError('OWNER_SPOOL_IO_FAILED');
              }
              if (bytesWritten <= 0) throw new Error('write stopped');
              hash.update(encoded.subarray(offset, offset + bytesWritten));
              offset += bytesWritten;
              position += bytesWritten;
            }
            acceptedBytes += encoded.length;
          } catch (error) {
            failed = true;
            throw error instanceof OwnerSpoolError
              ? error
              : new OwnerSpoolError('OWNER_SPOOL_INVALID_CAPTURE');
          }
        })();
        let wrapped: Promise<void>;
        wrapped = operation.finally(() => {
          callbackActive = false;
          if (pendingCallback === wrapped) pendingCallback = undefined;
        });
        pendingCallback = wrapped;
        return wrapped;
      };

      producerPromise = Promise.resolve()
        .then(() => producer(onChunk, controller.signal))
        .catch((error: unknown) => {
          throw error instanceof OwnerSpoolError
            ? error
            : new OwnerSpoolError('OWNER_SPOOL_INVALID_CAPTURE');
        });
      const returnedEnd = await Promise.race([
        producerPromise,
        timeoutPromise,
        externalAbortPromise,
      ]);
      accepting = false;
      if (callbackActive || failed || !terminal || !verifiedEnd) {
        throw new OwnerSpoolError('OWNER_SPOOL_INCOMPLETE_CAPTURE');
      }
      let terminalMatches = false;
      try {
        terminalMatches = Boolean(
          returnedEnd &&
            typeof returnedEnd === 'object' &&
            returnedEnd.source === 'end' &&
            JSON.stringify(returnedEnd) === JSON.stringify(terminal)
        );
      } catch {
        terminalMatches = false;
      }
      if (!terminalMatches)
        throw new OwnerSpoolError('OWNER_SPOOL_INCOMPLETE_CAPTURE');
      if (controller.signal.aborted) throw abortReason();
      await fileHandle.sync();
      if (controller.signal.aborted) throw abortReason();

      const summary = {
        participantId: options.participantId,
        accountId: options.accountId,
        captureId: terminal.captureId,
        snapshotAt: terminal.snapshotAt,
        sizeBytes: acceptedBytes,
        sha256: hash.digest('hex'),
        rowCount: terminal.rowCount!,
        sourceRowCounts: { ...terminal.sourceRowCounts } as Partial<
          Record<TSource, number>
        >,
        sourceDispositions: { ...terminal.sourceDispositions } as Partial<
          Record<TSource, string>
        >,
      } satisfies OwnerSpoolMetadata<TSource>;

      const handle = this.createHandle(fileHandle, summary);
      fileHandle = undefined;
      return handle;
    } catch (error) {
      accepting = false;
      failed = true;
      controller.abort();
      if (error instanceof OwnerSpoolError) throw error;
      if (options.signal?.aborted)
        throw new OwnerSpoolError('OWNER_SPOOL_ABORTED');
      throw new OwnerSpoolError('OWNER_SPOOL_IO_FAILED');
    } finally {
      if (timer) clearTimeout(timer);
      if (abortListener)
        options.signal?.removeEventListener('abort', abortListener);
      accepting = false;
      if (fileHandle) {
        if (pendingCallback) await Promise.allSettled([pendingCallback]);
        try {
          await fileHandle.close();
        } catch {
          /* closed best-effort */
        }
      }
      if (filePath && !fileUnlinked) {
        try {
          await unlink(filePath);
        } catch {
          /* cleanup best-effort */
        }
      }
      if (directory && !directoryRemoved) {
        try {
          await rmdir(directory);
        } catch {
          /* cleanup best-effort */
        }
      }
    }
  }

  private createHandle<TSource extends string>(
    fileHandle: Awaited<ReturnType<typeof open>>,
    metadata: OwnerSpoolMetadata<TSource>
  ): OwnerSpoolHandle<TSource> {
    let disposed = false;
    let cleanupPromise: Promise<void> | undefined;
    const streams = new Set<Readable>();
    let activeReadOps = 0;
    let opsDrained: (() => void) | undefined;
    const assertOpen = (): void => {
      if (disposed) throw new OwnerSpoolError('OWNER_SPOOL_CLOSED');
    };
    const close = (): Promise<void> => {
      if (cleanupPromise) return cleanupPromise;
      disposed = true;
      const activeStreams = [...streams];
      for (const stream of activeStreams) stream.destroy();
      cleanupPromise = (async () => {
        await Promise.all(
          activeStreams.map(
            (stream) =>
              new Promise<void>((resolve) => {
                if (stream.closed) resolve();
                else stream.once('close', () => resolve());
              })
          )
        );
        if (activeReadOps > 0)
          await new Promise<void>((resolve) => {
            opsDrained = resolve;
          });
        await fileHandle.close();
      })();
      return cleanupPromise;
    };
    const api: OwnerSpoolHandle<TSource> = {
      metadata: Object.freeze({
        ...metadata,
        sourceRowCounts: Object.freeze({ ...metadata.sourceRowCounts }),
        sourceDispositions: Object.freeze({ ...metadata.sourceDispositions }),
      }),
      createReadStream: (
        start = 0,
        endExclusive = metadata.sizeBytes
      ): Readable => {
        assertOpen();
        if (
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(endExclusive) ||
          start < 0 ||
          endExclusive < start ||
          endExclusive > metadata.sizeBytes
        )
          throw new OwnerSpoolError('OWNER_SPOOL_INVALID_RANGE');
        const stream =
          endExclusive === start
            ? Readable.from([])
            : fileHandle.createReadStream({
                autoClose: false,
                start,
                end: endExclusive - 1,
                highWaterMark: MAX_READ_CHUNK_BYTES,
              });
        streams.add(stream);
        stream.once('close', () => streams.delete(stream));
        return stream;
      },
      readChunk: async (offset: number, length: number): Promise<Buffer> => {
        assertOpen();
        if (
          !Number.isSafeInteger(offset) ||
          !Number.isSafeInteger(length) ||
          offset < 0 ||
          length < 0 ||
          length > MAX_READ_CHUNK_BYTES ||
          offset + length > metadata.sizeBytes
        )
          throw new OwnerSpoolError('OWNER_SPOOL_INVALID_RANGE');
        activeReadOps++;
        try {
          const buffer = Buffer.alloc(length);
          let read = 0;
          while (read < length) {
            assertOpen();
            const result = await fileHandle.read(
              buffer,
              read,
              length - read,
              offset + read
            );
            if (result.bytesRead <= 0)
              throw new OwnerSpoolError('OWNER_SPOOL_IO_FAILED');
            read += result.bytesRead;
          }
          return buffer.subarray(0, read);
        } catch (error) {
          if (error instanceof OwnerSpoolError) throw error;
          throw new OwnerSpoolError('OWNER_SPOOL_IO_FAILED');
        } finally {
          activeReadOps--;
          if (activeReadOps === 0) {
            opsDrained?.();
            opsDrained = undefined;
          }
        }
      },
      cleanup: close,
    };
    return api;
  }
}
