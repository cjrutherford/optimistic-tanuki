import {
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { constants as fsConstants, createReadStream } from 'node:fs';
import {
  chmod,
  mkdir,
  open,
  readdir,
  rm,
  stat,
  lstat,
  unlink,
} from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import { EnvelopeEncryptionService } from './envelope-encryption.service';

const DEFAULT_MAX_PLAINTEXT_BYTES = 1024 * 1024 * 1024;
const DEFAULT_MAX_CONCURRENT = 2;
const DEFAULT_SPOOL_BUDGET_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_ENVELOPE_HEADER_BYTES = 64 * 1024;

export interface VerifiedMediaSpoolOptions {
  spoolRoot?: string;
  maxPlaintextBytes?: number;
  maxConcurrent?: number;
  spoolBudgetBytes?: number;
}

export interface VerifiedMediaSpoolHandle {
  readonly path: string;
  readonly size: number;
  createReadStream(start?: number, end?: number): Readable;
  cleanup(): Promise<void>;
}

type Waiter = {
  resolve: (release: () => void) => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
};

/**
 * Authenticates the complete OTENV1 object into a private file before exposing
 * any plaintext. Memory is limited to source/decrypt chunks; a process-local
 * semaphore and byte budget bound temporary disk use.
 */
export class VerifiedMediaSpoolService {
  private static readonly activeProcessDirectories = new Set<string>();
  readonly processDirectory: string;
  private readonly spoolRoot: string;
  private readonly maxConcurrent: number;
  private readonly spoolBudgetBytes: number;
  private active = 0;
  private readonly waiters: Waiter[] = [];
  private ready?: Promise<void>;
  private quarantined = false;

  private readonly maxPlaintextBytes: number;
  private readonly hostPrefix = hostname().replace(/[^a-zA-Z0-9_-]/g, '_');

  get maxReadBytes(): number {
    return this.maxPlaintextBytes;
  }

  constructor(
    private readonly encryption: EnvelopeEncryptionService,
    options: VerifiedMediaSpoolOptions = {}
  ) {
    this.spoolRoot =
      options.spoolRoot ||
      process.env['ASSETS_MEDIA_SPOOL_DIR'] ||
      join(tmpdir(), 'ot-assets-media-spool');
    this.maxPlaintextBytes =
      options.maxPlaintextBytes ??
      configuredPositiveInt(
        'ASSETS_MEDIA_MAX_READ_BYTES',
        DEFAULT_MAX_PLAINTEXT_BYTES
      );
    this.maxConcurrent =
      options.maxConcurrent ??
      configuredPositiveInt(
        'ASSETS_MEDIA_SPOOL_MAX_CONCURRENT',
        DEFAULT_MAX_CONCURRENT
      );
    this.spoolBudgetBytes =
      options.spoolBudgetBytes ??
      configuredPositiveInt(
        'ASSETS_MEDIA_SPOOL_BUDGET_BYTES',
        DEFAULT_SPOOL_BUDGET_BYTES
      );

    if (
      this.maxPlaintextBytes <= 0 ||
      this.maxConcurrent <= 0 ||
      !Number.isSafeInteger(this.maxPlaintextBytes * this.maxConcurrent) ||
      this.spoolBudgetBytes < this.maxPlaintextBytes * this.maxConcurrent
    ) {
      throw new Error(
        'Media spool budget must cover max read bytes multiplied by max concurrent reads.'
      );
    }

    this.processDirectory = join(
      this.spoolRoot,
      `spool-${this.hostPrefix}-${process.pid}-${randomBytes(12).toString(
        'hex'
      )}`
    );
    VerifiedMediaSpoolService.activeProcessDirectories.add(
      this.processDirectory
    );
  }

  async create(
    sourceFactory: (signal?: AbortSignal) => Promise<Readable> | Readable,
    options: { maxPlaintextBytes?: number; signal?: AbortSignal } = {}
  ): Promise<VerifiedMediaSpoolHandle> {
    const maxBytes = Math.min(
      options.maxPlaintextBytes ?? this.maxPlaintextBytes,
      this.maxPlaintextBytes
    );
    const release = await this.acquire(options.signal);
    let source: Readable | undefined;
    let filePath: string | undefined;
    let fileHandle: Awaited<ReturnType<typeof open>> | undefined;
    let keepSpool = false;
    let reserveSlotAfterFailure = false;
    let onAbort: (() => void) | undefined;
    let decipher:
      | ReturnType<EnvelopeEncryptionService['createStreamingDecryptor']>
      | undefined;

    try {
      await this.ensureDirectory();
      if (options.signal?.aborted) throw abortError();
      filePath = join(
        this.processDirectory,
        `media-${randomBytes(16).toString('hex')}.plain`
      );
      fileHandle = await open(
        filePath,
        fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL,
        0o600
      );
      source = await sourceFactory(options.signal);
      onAbort = () => source?.destroy(abortError());
      options.signal?.addEventListener('abort', onAbort, { once: true });
      if (options.signal?.aborted) throw abortError();

      const { headerBytes, firstCiphertext } = await readEnvelopeHeader(
        source,
        options.signal
      );
      const header = this.encryption.parseEnvelopeHeader(headerBytes);
      decipher = this.encryption.createStreamingDecryptor(header);
      let cipherBytes = 0;
      let plainBytes = 0;

      const writePlaintext = async (plain: Buffer): Promise<void> => {
        if (plain.length === 0) return;
        plainBytes += plain.length;
        if (plainBytes > maxBytes) {
          throw new PayloadTooLargeException(
            `Media exceeds the ${maxBytes}-byte authenticated retrieval limit.`
          );
        }
        let offset = 0;
        while (offset < plain.length) {
          const { bytesWritten } = await fileHandle!.write(
            plain,
            offset,
            plain.length - offset,
            null
          );
          if (bytesWritten <= 0) {
            throw new ServiceUnavailableException(
              'Media spool stopped accepting authenticated plaintext.'
            );
          }
          offset += bytesWritten;
        }
      };

      if (firstCiphertext.length > 0) {
        cipherBytes += firstCiphertext.length;
        if (cipherBytes > maxBytes) {
          throw new PayloadTooLargeException(
            `Media exceeds the ${maxBytes}-byte authenticated retrieval limit.`
          );
        }
        await writePlaintext(decipher.update(firstCiphertext));
      }

      for await (const rawChunk of source) {
        if (options.signal?.aborted) throw abortError();
        const chunk = Buffer.isBuffer(rawChunk)
          ? rawChunk
          : Buffer.from(rawChunk as Uint8Array);
        cipherBytes += chunk.length;
        if (cipherBytes > maxBytes) {
          throw new PayloadTooLargeException(
            `Media exceeds the ${maxBytes}-byte authenticated retrieval limit.`
          );
        }
        await writePlaintext(decipher.update(chunk));
      }

      // This final call is the only point at which the envelope is trusted.
      await writePlaintext(decipher.final());
      if (plainBytes !== cipherBytes) {
        throw new ServiceUnavailableException(
          'Authenticated media length does not match its encrypted payload.'
        );
      }
      await fileHandle.sync();
      await fileHandle.close();
      fileHandle = undefined;
      keepSpool = true;

      let cleaned = false;
      return {
        path: filePath,
        size: plainBytes,
        createReadStream: (start?: number, end?: number) =>
          createReadStream(filePath!, {
            ...(start === undefined ? {} : { start }),
            ...(end === undefined ? {} : { end }),
          }),
        cleanup: async () => {
          if (cleaned) return;
          try {
            await this.removeSpoolFile(filePath!);
            cleaned = true;
          } catch (error) {
            this.quarantined = true;
            throw error;
          }
          if (cleaned) {
            release();
          }
        },
      };
    } catch (error) {
      source?.destroy();
      decipher?.destroy();
      if (fileHandle) await fileHandle.close().catch(() => undefined);
      if (filePath) {
        try {
          await this.removeSpoolFile(filePath);
        } catch {
          this.quarantined = true;
          reserveSlotAfterFailure = true;
        }
      }
      throw error;
    } finally {
      if (onAbort) options.signal?.removeEventListener('abort', onAbort);
      if (!keepSpool && !reserveSlotAfterFailure) release();
    }
  }

  private async ensureDirectory(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        await mkdir(this.spoolRoot, { recursive: true, mode: 0o700 });
        const root = await lstat(this.spoolRoot);
        if (!root.isDirectory() || root.isSymbolicLink()) {
          throw new ServiceUnavailableException(
            'Media spool root must be a private directory.'
          );
        }
        await chmod(this.spoolRoot, 0o700);
        await this.cleanupOrphans();
        await mkdir(this.processDirectory, { mode: 0o700 });
        await chmod(this.processDirectory, 0o700);
      })().catch((error) => {
        this.ready = undefined;
        throw error;
      });
    }
    return this.ready;
  }

  private async cleanupOrphans(): Promise<void> {
    const entries = await readdir(this.spoolRoot, { withFileTypes: true });
    for (const entry of entries) {
      const match = /^spool-(.+)-(\d+)-[a-f0-9]{24}$/.exec(entry.name);
      if (!match || !entry.isDirectory()) continue;
      const candidate = join(this.spoolRoot, entry.name);
      if (VerifiedMediaSpoolService.activeProcessDirectories.has(candidate)) {
        continue;
      }
      const host = match[1];
      const pid = Number(match[2]);
      if (host !== this.hostPrefix) continue;
      if (
        pid === process.pid
          ? VerifiedMediaSpoolService.activeProcessDirectories.has(candidate)
          : isProcessAlive(pid)
      ) {
        continue;
      }
      const info = await lstat(candidate).catch(() => undefined);
      if (!info?.isDirectory() || info.isSymbolicLink()) {
        continue;
      }
      // A spool belongs to a host/process-specific directory. Remove it only
      // after the recorded OS process is confirmed absent; never age-delete an
      // active process's spool. Host-specific names avoid cross-container PID
      // collisions on shared parent volumes.
      await rm(candidate, { recursive: true, force: true });
    }
  }

  protected async removeSpoolFile(filePath: string): Promise<void> {
    await unlinkWithRetry(filePath);
  }

  private acquire(signal?: AbortSignal): Promise<() => void> {
    if (this.quarantined) {
      return Promise.reject(
        new ServiceUnavailableException(
          'Media spool cleanup failed; this process refuses further reads.'
        )
      );
    }
    if (signal?.aborted) return Promise.reject(abortError());
    if (this.active < this.maxConcurrent) {
      this.active += 1;
      return Promise.resolve(this.makeRelease());
    }
    const maxWaiters = this.maxConcurrent * 4;
    if (this.waiters.length >= maxWaiters) {
      return Promise.reject(
        new ServiceUnavailableException('Media spool capacity is busy.')
      );
    }
    return new Promise((resolve, reject) => {
      const waiter: Waiter = { resolve, reject, signal };
      waiter.onAbort = () => {
        const index = this.waiters.indexOf(waiter);
        if (index >= 0) this.waiters.splice(index, 1);
        reject(abortError());
      };
      signal?.addEventListener('abort', waiter.onAbort, { once: true });
      this.waiters.push(waiter);
    });
  }

  private makeRelease(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active = Math.max(0, this.active - 1);
      while (this.waiters.length > 0) {
        const next = this.waiters.shift()!;
        next.signal?.removeEventListener('abort', next.onAbort!);
        if (next.signal?.aborted) {
          next.reject(abortError());
          continue;
        }
        this.active += 1;
        next.resolve(this.makeRelease());
        break;
      }
    };
  }
}

async function readEnvelopeHeader(
  source: Readable,
  signal?: AbortSignal
): Promise<{ headerBytes: Buffer; firstCiphertext: Buffer }> {
  const iterator = source[Symbol.asyncIterator]();
  const chunks: Buffer[] = [];
  let total = 0;
  while (total <= MAX_ENVELOPE_HEADER_BYTES) {
    if (signal?.aborted) throw abortError();
    const next = await iterator.next();
    if (next.done) break;
    const chunk = Buffer.isBuffer(next.value)
      ? next.value
      : Buffer.from(next.value as Uint8Array);
    const newline = chunk.indexOf(0x0a);
    if (newline >= 0) {
      const headerPart = chunk.subarray(0, newline + 1);
      total += headerPart.length;
      if (total > MAX_ENVELOPE_HEADER_BYTES) break;
      chunks.push(headerPart);
      return {
        headerBytes: Buffer.concat(chunks, total),
        firstCiphertext: chunk.subarray(newline + 1),
      };
    }
    chunks.push(chunk);
    total += chunk.length;
  }
  source.destroy();
  throw new ServiceUnavailableException(
    'Vault storage envelope header is missing or too large.'
  );
}

function configuredPositiveInt(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive safe integer.`);
  }
  return parsed;
}

async function unlinkWithRetry(filePath: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await unlink(filePath);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
    }
  }
}

function abortError(): Error {
  const error = new Error('Media read was cancelled.');
  error.name = 'AbortError';
  return error;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}
