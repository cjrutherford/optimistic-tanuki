import { createHash, randomUUID } from 'node:crypto';
import { open, mkdtemp, mkdir, lstat, rmdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import {
  ACCOUNT_EXPORT_RELEASE_OWNERS,
  evaluateAccountExportReleaseCoverage,
  AccountExportOwnerCaptureVerifier,
  AccountExportOwnerChunk,
} from '@optimistic-tanuki/models';
import { OwnerSpoolHandle } from './account-export-owner-spool.service';
import { AccountExportArtifactMediaCollector } from './account-export-artifact-media';

export interface AccountExportArtifactManifest {
  version: 1;
  appId: string;
  accountId: string;
  owners: Array<{
    owner: string;
    captureId: string;
    snapshotAt: string;
    rowCount: number;
    sizeBytes: number;
    sha256: string;
    sourceRowCounts: Record<string, number>;
    sourceDispositions: Record<string, string>;
  }>;
  media: Array<{
    assetId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    hlsReferenceAssetIds?: string[];
    sourceSha256?: string;
    sourceSizeBytes?: number;
    disposition: 'included';
  }>;
}
export interface AccountExportArtifactHandle {
  readonly metadata: Readonly<{
    fileName: 'account-export.tar';
    mimeType: 'application/x-tar';
    sizeBytes: number;
    sha256: string;
    manifest: Readonly<AccountExportArtifactManifest>;
  }>;
  createReadStream(): Readable;
  readChunk(offset: number, length: number): Promise<Buffer>;
  cleanup(): Promise<void>;
}
export interface AccountExportArtifactBuildOptions {
  appId: string;
  accountId: string;
  owners: readonly OwnerSpoolHandle<string>[];
  expectedSourcesByOwner: Readonly<Record<string, readonly string[]>>;
  signal?: AbortSignal;
  spoolRoot?: string;
  maxArtifactBytes?: number;
}

const TOTAL_LIMIT = 512 * 1024 * 1024;
const OWNER_LIMIT = 256 * 1024 * 1024;
const LINE_LIMIT = 512 * 1024;
const CHUNK_LIMIT = 64 * 1024;
const ROW_LIMIT = 100_000;
type FileHandle = Awaited<ReturnType<typeof open>>;
type Entry = { name: string; size: number; sha256: string; stream(): Readable };

/** Stages each verified stream once; no named plaintext survives a process exit. */
export class AccountExportArtifactBuilderService {
  private readonly deletedAccounts = new Set<string>();
  private readonly openings = new Map<
    AbortController,
    { key: string; work: Promise<unknown> }
  >();
  private readonly resources = new Map<
    () => Promise<void>,
    { key: string; cleanup: () => Promise<void>; files: FileHandle[] }
  >();
  private accountKey(accountId: string): string {
    return createHash('sha256')
      .update('ot:artifact-build:' + accountId.toLowerCase())
      .digest('hex');
  }
  async build(
    options: AccountExportArtifactBuildOptions
  ): Promise<AccountExportArtifactHandle> {
    if (!options || typeof options.accountId !== 'string')
      throw Error('ARTIFACT_INVALID_INPUT');
    const key = this.accountKey(options.accountId);
    if (this.deletedAccounts.has(key)) throw Error('ARTIFACT_ACCOUNT_FENCED');
    const controller = new AbortController();
    const signal = options.signal
      ? AbortSignal.any([options.signal, controller.signal])
      : controller.signal;
    const work = this.buildCurrent({ ...options, signal }, (cleanup, files) => {
      this.resources.set(cleanup, { key, cleanup, files });
      return () => {
        this.resources.delete(cleanup);
      };
    });
    this.openings.set(controller, { key, work });
    try {
      const result = await work;
      if (this.deletedAccounts.has(key)) {
        await result.cleanup();
        throw Error('ARTIFACT_ACCOUNT_FENCED');
      }
      return result;
    } finally {
      this.openings.delete(controller);
    }
  }
  async purgeAccount(accountId: string): Promise<{ remaining: 0 }> {
    const key = this.checkedAccountKey(accountId);
    if (!this.deletedAccounts.has(key) && this.deletedAccounts.size >= 10000)
      throw Error('ARTIFACT_DELETION_BOUND');
    this.deletedAccounts.add(key);
    const pending = [...this.openings].filter(([, value]) => value.key === key);
    for (const [controller] of pending) controller.abort();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const drain = async () => {
        await Promise.allSettled(pending.map(([, value]) => value.work));
        for (const resource of [...this.resources.values()])
          if (resource.key === key) await resource.cleanup();
        if ((await this.readbackAccount(accountId)) !== 0)
          throw Error('ARTIFACT_DELETION_READBACK');
        return { remaining: 0 as const };
      };
      return await Promise.race([
        drain(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(Error('ARTIFACT_DELETION_DRAIN_TIMEOUT')),
            56000
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  async readbackAccount(accountId: string): Promise<number> {
    const key = this.checkedAccountKey(accountId);
    if (!this.deletedAccounts.has(key))
      throw Error('ARTIFACT_DELETION_FENCE_REQUIRED');
    return (
      [...this.openings.values()].filter((value) => value.key === key).length +
      [...this.resources.values()].filter((value) => value.key === key).length
    );
  }
  private checkedAccountKey(accountId: string): string {
    if (
      typeof accountId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        accountId
      )
    )
      throw Error('ARTIFACT_DELETION_ACCOUNT_INVALID');
    return this.accountKey(accountId);
  }

  private async buildCurrent(
    options: AccountExportArtifactBuildOptions,
    register: (cleanup: () => Promise<void>, files: FileHandle[]) => () => void
  ): Promise<AccountExportArtifactHandle> {
    const maxBytes = options.maxArtifactBytes ?? TOTAL_LIMIT;
    if (
      !Number.isSafeInteger(maxBytes) ||
      maxBytes < 1024 ||
      maxBytes > TOTAL_LIMIT ||
      !Array.isArray(options.owners) ||
      options.owners.length !== ACCOUNT_EXPORT_RELEASE_OWNERS.length
    )
      throw new Error('ARTIFACT_INVALID_INPUT');
    assertActive(options.signal);
    const parent = options.spoolRoot ?? tmpdir();
    const parentStat = await lstat(parent);
    if (!parentStat.isDirectory() || parentStat.isSymbolicLink())
      throw new Error('ARTIFACT_SPOOL_ROOT_INVALID');
    const root = await mkdtemp(join(parent, 'ot-account-export-'));
    const files: FileHandle[] = [];
    const pendingPaths = new Set<string>();
    const streams = new Set<Readable>();
    let media: AccountExportArtifactMediaCollector | undefined;
    let mediaRoot: string | undefined;
    let returned = false;
    let cleaned = false;
    let cleanupPromise: Promise<void> | undefined;
    const cleanup = (): Promise<void> =>
      (cleanupPromise ??= (async () => {
        cleaned = true;
        const errors: unknown[] = [];
        await Promise.all(
          [...streams].map(
            (stream) =>
              new Promise<void>((resolve) => {
                if (stream.closed) return resolve();
                stream.once('error', (error) => {
                  errors.push(error);
                });
                stream.once('close', () => resolve());
                stream.destroy();
              })
          )
        );
        for (const file of files) {
          try {
            await file.close();
          } catch (e) {
            errors.push(e);
          }
        }
        if (media) {
          try {
            await media.cleanup();
          } catch (e) {
            errors.push(e);
          }
        }
        for (const path of pendingPaths) {
          try {
            await unlink(path);
            pendingPaths.delete(path);
          } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== 'ENOENT') errors.push(e);
            else pendingPaths.delete(path);
          }
        }
        if (mediaRoot) {
          try {
            await rmdir(mediaRoot);
          } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== 'ENOENT') errors.push(e);
          }
        }
        try {
          await rmdir(root);
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== 'ENOENT') errors.push(e);
        }
        if (errors.length) throw cleanupError(errors[0]);
        retire();
      })().catch((error) => {
        cleanupPromise = undefined;
        throw error;
      }));
    const retire = register(cleanup, files);
    const privateFile = async (): Promise<FileHandle> => {
      const path = join(root, randomUUID());
      const file = await open(path, 'wx+', 0o600);
      files.push(file);
      pendingPaths.add(path);
      try {
        await unlink(path);
        pendingPaths.delete(path);
      } catch (e) {
        await file.close();
        throw e;
      }
      return file;
    };
    const fileStream = (file: FileHandle, size: number): Readable => {
      if (cleaned) throw new Error('ARTIFACT_CLOSED');
      const stream = file.createReadStream({
        start: 0,
        end: size - 1,
        highWaterMark: CHUNK_LIMIT,
        autoClose: false,
      });
      streams.add(stream);
      stream.once('close', () => streams.delete(stream));
      return stream;
    };
    const writeAll = async (
      file: FileHandle,
      data: Buffer,
      position: number
    ): Promise<void> => {
      for (let at = 0; at < data.length; ) {
        assertActive(options.signal);
        const result = await file.write(
          data,
          at,
          data.length - at,
          position + at
        );
        if (!result.bytesWritten) throw new Error('ARTIFACT_IO_FAILED');
        at += result.bytesWritten;
      }
    };
    try {
      const handles = new Map(
        options.owners.map((h) => [h.metadata.participantId, h])
      );
      if (
        handles.size !== options.owners.length ||
        ACCOUNT_EXPORT_RELEASE_OWNERS.some((o) => !handles.has(o))
      )
        throw new Error('ARTIFACT_OWNER_SET_INVALID');
      const metadata = ACCOUNT_EXPORT_RELEASE_OWNERS.map((owner) => {
        const original = handles.get(owner)!.metadata;
        if (
          !original ||
          !original.sourceRowCounts ||
          !original.sourceDispositions
        )
          throw new Error('ARTIFACT_OWNER_METADATA_INVALID');
        return {
          ...original,
          sourceRowCounts: cloneCounts(original.sourceRowCounts),
          sourceDispositions: cloneStrings(original.sourceDispositions),
        };
      });
      if (
        !evaluateAccountExportReleaseCoverage(
          options.appId,
          options.accountId,
          metadata,
          options.expectedSourcesByOwner
        ).complete
      )
        throw new Error('ARTIFACT_COVERAGE_INCOMPLETE');
      const manifest: AccountExportArtifactManifest = {
        version: 1,
        appId: options.appId,
        accountId: options.accountId,
        owners: [],
        media: [],
      };
      const entries: Entry[] = [];
      mediaRoot = join(root, 'media-staging');
      await mkdir(mediaRoot, { mode: 0o700 });
      media = new AccountExportArtifactMediaCollector({
        root: mediaRoot,
        signal: options.signal,
        maxBytes,
      });
      let aggregate = 0;
      for (const meta of metadata) {
        if (
          meta.sizeBytes < 1 ||
          meta.sizeBytes > OWNER_LIMIT ||
          meta.rowCount > ROW_LIMIT
        )
          throw new Error('ARTIFACT_OWNER_METADATA_INVALID');
        aggregate += meta.sizeBytes;
        if (aggregate > maxBytes) throw new Error('ARTIFACT_TOO_LARGE');
        const output = await privateFile();
        const verifier = new AccountExportOwnerCaptureVerifier(
          meta.participantId,
          options.accountId,
          options.expectedSourcesByOwner[meta.participantId],
          createHash('sha256')
        );
        const hash = createHash('sha256');
        let carry = Buffer.alloc(0),
          total = 0,
          rows = 0;
        let terminal: AccountExportOwnerChunk<string> | undefined;
        for await (const raw of handles
          .get(meta.participantId)!
          .createReadStream()) {
          assertActive(options.signal);
          const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
          if (
            buffer.length > CHUNK_LIMIT ||
            total + buffer.length > meta.sizeBytes
          )
            throw new Error('ARTIFACT_OWNER_TAMPERED');
          hash.update(buffer);
          await writeAll(output, buffer, total);
          total += buffer.length;
          const pending = carry.length
            ? Buffer.concat([carry, buffer])
            : buffer;
          let start = 0,
            newline: number;
          while ((newline = pending.indexOf(10, start)) !== -1) {
            const line = pending.subarray(start, newline);
            if (line.length > LINE_LIMIT)
              throw new Error('ARTIFACT_OWNER_LINE_TOO_LARGE');
            const chunk = JSON.parse(
              line.toString('utf8')
            ) as AccountExportOwnerChunk<string>;
            if (verifier.accept(chunk)) terminal = chunk;
            else {
              rows += chunk.records.length;
              if (rows > ROW_LIMIT) throw new Error('ARTIFACT_OWNER_ROW_LIMIT');
              if (meta.participantId === 'assets')
                for (const record of chunk.records)
                  if (record.source === 'assetMedia')
                    await media.accept(record.data);
            }
            start = newline + 1;
          }
          carry = Buffer.from(pending.subarray(start));
          if (carry.length > LINE_LIMIT)
            throw new Error('ARTIFACT_OWNER_LINE_TOO_LARGE');
        }
        if (
          carry.length ||
          total !== meta.sizeBytes ||
          hash.digest('hex') !== meta.sha256 ||
          !terminal ||
          terminal.captureId !== meta.captureId ||
          terminal.snapshotAt !== meta.snapshotAt ||
          rows !== meta.rowCount ||
          terminal.rowCount !== meta.rowCount
        )
          throw new Error('ARTIFACT_OWNER_TAMPERED');
        for (const source of options.expectedSourcesByOwner[
          meta.participantId
        ]) {
          if (
            terminal.sourceRowCounts?.[source] !==
              meta.sourceRowCounts[source] ||
            terminal.sourceDispositions?.[source] !==
              meta.sourceDispositions[source]
          )
            throw new Error('ARTIFACT_OWNER_TAMPERED');
        }
        await output.sync();
        entries.push({
          name: `owners/${meta.participantId}.ndjson`,
          size: total,
          sha256: meta.sha256,
          stream: () => fileStream(output, total),
        });
        manifest.owners.push({
          owner: meta.participantId,
          captureId: meta.captureId,
          snapshotAt: meta.snapshotAt,
          rowCount: rows,
          sizeBytes: total,
          sha256: meta.sha256,
          sourceRowCounts: meta.sourceRowCounts,
          sourceDispositions: meta.sourceDispositions,
        });
      }
      for (const item of await media.finish()) {
        entries.push({
          name: `media/${item.fileName}`,
          size: item.sizeBytes,
          sha256: item.sha256,
          stream: () => item.createReadStream(),
        });
        const source = item as typeof item & {
          sourceSha256?: string;
          sourceSizeBytes?: number;
        };
        manifest.media.push({
          assetId: item.assetId,
          fileName: item.fileName,
          mimeType: item.mimeType,
          sizeBytes: item.sizeBytes,
          sha256: item.sha256,
          ...(item.hlsReferenceAssetIds
            ? { hlsReferenceAssetIds: [...item.hlsReferenceAssetIds] }
            : {}),
          ...(source.sourceSha256
            ? {
                sourceSha256: source.sourceSha256,
                sourceSizeBytes: source.sourceSizeBytes,
              }
            : {}),
          disposition: 'included',
        });
      }
      const manifestBytes = Buffer.from(JSON.stringify(manifest) + '\n');
      if (manifestBytes.length > LINE_LIMIT)
        throw new Error('ARTIFACT_MANIFEST_TOO_LARGE');
      entries.unshift({
        name: 'manifest.json',
        size: manifestBytes.length,
        sha256: createHash('sha256').update(manifestBytes).digest('hex'),
        stream: () => Readable.from([manifestBytes]),
      });
      const artifact = await privateFile();
      let position = 0;
      const artifactHash = createHash('sha256');
      const append = async (data: Buffer) => {
        if (position + data.length > maxBytes)
          throw new Error('ARTIFACT_TOO_LARGE');
        await writeAll(artifact, data, position);
        position += data.length;
        artifactHash.update(data);
      };
      for (const entry of entries) {
        await append(tarHeader(entry.name, entry.size));
        let size = 0;
        const hash = createHash('sha256');
        for await (const raw of entry.stream()) {
          const data = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
          size += data.length;
          if (size > entry.size) throw new Error('ARTIFACT_ENTRY_TAMPERED');
          hash.update(data);
          await append(data);
        }
        if (size !== entry.size || hash.digest('hex') !== entry.sha256)
          throw new Error('ARTIFACT_ENTRY_TAMPERED');
        const padding = (512 - (size % 512)) % 512;
        if (padding) await append(Buffer.alloc(padding));
      }
      await append(Buffer.alloc(1024));
      await artifact.sync();
      const sizeBytes = position;
      const result: AccountExportArtifactHandle = {
        metadata: Object.freeze({
          fileName: 'account-export.tar',
          mimeType: 'application/x-tar',
          sizeBytes,
          sha256: artifactHash.digest('hex'),
          manifest: deepFreeze(manifest),
        }),
        createReadStream: () => fileStream(artifact, sizeBytes),
        readChunk: async (offset, length) => {
          if (cleaned) throw new Error('ARTIFACT_CLOSED');
          if (
            !Number.isSafeInteger(offset) ||
            !Number.isSafeInteger(length) ||
            offset < 0 ||
            length < 0 ||
            length > CHUNK_LIMIT ||
            offset + length > sizeBytes
          )
            throw new Error('ARTIFACT_INVALID_RANGE');
          const data = Buffer.alloc(length);
          const read = await artifact.read(data, 0, length, offset);
          if (read.bytesRead !== length) throw new Error('ARTIFACT_IO_FAILED');
          return data;
        },
        cleanup,
      };
      returned = true;
      return result;
    } finally {
      if (!returned) await cleanup();
    }
  }
}

function assertActive(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('ARTIFACT_ABORTED');
}
function cloneCounts(
  value: Partial<Record<string, number>>
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(value).map(([key, count]) => {
      if (
        typeof count !== 'number' ||
        !Number.isSafeInteger(count) ||
        count < 0
      )
        throw new Error('ARTIFACT_OWNER_METADATA_INVALID');
      return [key, count];
    })
  );
}
function cloneStrings(
  value: Partial<Record<string, string>>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (typeof item !== 'string')
        throw new Error('ARTIFACT_OWNER_METADATA_INVALID');
      return [key, item];
    })
  );
}

function cleanupError(cause: unknown): Error {
  const error = new Error('ARTIFACT_CLEANUP_FAILED') as Error & {
    cause?: unknown;
  };
  error.cause = cause;
  return error;
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child);
  }
  return value;
}
function tarHeader(name: string, size: number): Buffer {
  if (
    !/^[a-z0-9./-]+$/.test(name) ||
    name.startsWith('/') ||
    name.split('/').some((part) => part === '..') ||
    Buffer.byteLength(name, 'ascii') > 100
  )
    throw new Error('ARTIFACT_TAR_PATH_INVALID');
  const block = Buffer.alloc(512);
  block.write(name, 0, 100, 'ascii');
  octal(block, 100, 8, 0o600);
  octal(block, 108, 8, 0);
  octal(block, 116, 8, 0);
  octal(block, 124, 12, size);
  octal(block, 136, 12, 0);
  block.fill(32, 148, 156);
  block[156] = 48;
  block.write('ustar\0', 257, 6, 'ascii');
  block.write('00', 263, 2, 'ascii');
  let checksum = 0;
  for (const byte of block) checksum += byte;
  block.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
  return block;
}
function octal(
  block: Buffer,
  offset: number,
  length: number,
  value: number
): void {
  block.write(
    value.toString(8).padStart(length - 1, '0') + '\0',
    offset,
    length,
    'ascii'
  );
}
