import {
  localCustodyIdentity,
  localCustodyProbe,
  CustodyProbeMode,
} from './local-custody-identity';
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, unlink, link } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { EnvelopeEncryptionService } from './envelope-encryption.service';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/i;
const FRAME = 64 * 1024;
const MAX_FRAME_CONTAINER = 128 * 1024;
const MAX_ARTIFACT = 512 * 1024 * 1024;
const MAGIC = Buffer.from('OTAS1');
const APPS = new Set(['client-interface', 'local-hub']);

export interface ArtifactDescriptor {
  readonly artifactId: string;
  readonly jobId: string;
  readonly accountId: string;
  readonly appId: string;
  readonly attempt: number;
  readonly expiresAt: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly frameCount: number;
  readonly framingVersion: 1;
}
export interface PutArtifactInput
  extends Omit<ArtifactDescriptor, 'frameCount' | 'framingVersion'> {
  stream: Readable;
  signal?: AbortSignal;
  assertCurrent?: () => Promise<boolean>;
  /** The durable ledger owner holds its row lock while final publication commits. */
  withCurrentLease?: (commit: () => Promise<void>) => Promise<void>;
}
export interface OpenArtifactOptions {
  signal?: AbortSignal;
  assertCurrent?: () => Promise<boolean>;
}
export interface VerifiedArtifact {
  sizeBytes: number;
  createReadStream(start?: number, endExclusive?: number): Readable;
  readChunk(offset: number, length: number): Promise<Buffer>;
  cleanup(): Promise<void>;
}

/** Encrypted, immutable account-export artifact storage. */
export class AccountExportArtifactStoreService {
  private readonly runtimeFiles = new Map<
    Awaited<ReturnType<typeof open>>,
    string
  >();
  private readonly runtimeOperations = new Map<
    AbortController,
    { key: string; work: Promise<unknown> }
  >();
  private readonly deletedAccounts = new Set<string>();
  private accountKey(accountId: string): string {
    return createHash('sha256')
      .update('ot:artifact-runtime:' + accountId.toLowerCase())
      .digest('hex');
  }
  private ownFile(
    accountId: string,
    file: Awaited<ReturnType<typeof open>>
  ): void {
    if (this.runtimeFiles.has(file)) return;
    this.runtimeFiles.set(file, this.accountKey(accountId));
    const close = file.close.bind(file);
    file.close = async () => {
      await close();
      this.runtimeFiles.delete(file);
    };
  }
  private async runtimeOperation<T>(
    accountId: string,
    signal: AbortSignal | undefined,
    run: (signal: AbortSignal) => Promise<T>
  ): Promise<T> {
    const key = this.accountKey(accountId);
    if (this.deletedAccounts.has(key)) throw Error('ARTIFACT_ACCOUNT_FENCED');
    const controller = new AbortController();
    const combined = signal
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal;
    const work = run(combined);
    this.runtimeOperations.set(controller, { key, work });
    try {
      return await work;
    } finally {
      this.runtimeOperations.delete(controller);
    }
  }
  async put(input: PutArtifactInput): Promise<ArtifactDescriptor> {
    input = { ...input };
    validateInput(input);
    return this.runtimeOperation(
      input.accountId,
      input.signal,
      async (signal) => {
        const result = await this.putCurrent({ ...input, signal });
        assertLive(signal);
        return result;
      }
    );
  }
  async openVerified(
    descriptor: ArtifactDescriptor,
    options: OpenArtifactOptions = {}
  ): Promise<VerifiedArtifact> {
    descriptor = Object.freeze({ ...descriptor });
    validateDescriptor(descriptor);
    return this.runtimeOperation(
      descriptor.accountId,
      options.signal,
      async (signal) => {
        const result = await this.openVerifiedCurrent(descriptor, {
          ...options,
          signal,
        });
        if (signal.aborted) {
          await result.cleanup();
          throw Error('ARTIFACT_ACCOUNT_FENCED');
        }
        return result;
      }
    );
  }
  async purgeAccountRuntime(accountId: string): Promise<{ remaining: 0 }> {
    if (!UUID.test(accountId)) throw Error('ARTIFACT_DELETION_ACCOUNT_INVALID');
    const key = this.accountKey(accountId);
    if (!this.deletedAccounts.has(key) && this.deletedAccounts.size >= 10000)
      throw Error('ARTIFACT_DELETION_BOUND');
    this.deletedAccounts.add(key);
    const pending = [...this.runtimeOperations].filter(
      ([, value]) => value.key === key
    );
    for (const [controller] of pending) controller.abort();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const drain = async () => {
        await Promise.allSettled(pending.map(([, value]) => value.work));
        for (const [file, owner] of this.runtimeFiles)
          if (owner === key) await file.close();
        if ((await this.readbackAccountRuntime(accountId)) !== 0)
          throw Error('ARTIFACT_RUNTIME_READBACK');
        return { remaining: 0 as const };
      };
      return await Promise.race([
        drain(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(Error('ARTIFACT_RUNTIME_DRAIN_TIMEOUT')),
            56000
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  async readbackAccountRuntime(accountId: string): Promise<number> {
    if (!UUID.test(accountId)) throw Error('ARTIFACT_DELETION_ACCOUNT_INVALID');
    const key = this.accountKey(accountId);
    if (!this.deletedAccounts.has(key))
      throw Error('ARTIFACT_RUNTIME_FENCE_REQUIRED');
    return (
      [...this.runtimeOperations.values()].filter((value) => value.key === key)
        .length +
      [...this.runtimeFiles.values()].filter((owner) => owner === key).length
    );
  }
  private readonly maxBytes: number;
  private readonly now: () => number;
  constructor(
    private readonly encryption: EnvelopeEncryptionService,
    private readonly options: {
      root: string;
      maxBytes?: number;
      now?: () => number;
    }
  ) {
    this.maxBytes = options.maxBytes ?? MAX_ARTIFACT;
    this.now = options.now ?? Date.now;
    if (
      !Number.isSafeInteger(this.maxBytes) ||
      this.maxBytes < 1 ||
      this.maxBytes > MAX_ARTIFACT
    )
      throw new Error('ARTIFACT_STORE_BUDGET_INVALID');
  }

  private async putCurrent(
    input: PutArtifactInput
  ): Promise<ArtifactDescriptor> {
    input = { ...input };
    validateInput(input);
    if (Date.parse(input.expiresAt) <= this.now())
      throw new Error('ARTIFACT_EXPIRED');
    const root = await this.ensureRoot();
    const tempName = `.pending${input.artifactId}`;
    const finalName = input.artifactId;
    const tempPath = join(root, tempName);
    const finalPath = join(root, finalName);
    let file!: Awaited<ReturnType<typeof open>>;
    const reserve = async () => {
      file = await open(
        tempPath,
        constants.O_WRONLY |
          constants.O_CREAT |
          constants.O_EXCL |
          (constants.O_NOFOLLOW ?? 0),
        0o600
      );
      this.ownFile(input.accountId, file);
    };
    if (input.withCurrentLease) await input.withCurrentLease(reserve);
    else await reserve();
    if (!file) throw new Error('ARTIFACT_RESERVATION_FAILED');
    let published = false;
    try {
      await file.write(MAGIC, 0, MAGIC.length, 0);
      const opaqueId = Buffer.from(input.artifactId.replace(/-/g, ''), 'hex');
      await file.write(opaqueId, 0, opaqueId.length, MAGIC.length);
      let position = MAGIC.length + opaqueId.length;
      let frameCount = 0;
      let total = 0;
      const hash = createHash('sha256');
      let pending = Buffer.alloc(0);
      const emit = async (plain: Buffer): Promise<void> => {
        assertLive(input.signal);
        await assertCurrent(input.assertCurrent);
        if (
          total + plain.length > input.sizeBytes ||
          total + plain.length > this.maxBytes
        )
          throw new Error('ARTIFACT_SIZE_EXCEEDED');
        const aad = frameAad(input, frameCount);
        const encrypted = this.encryption.encrypt(plain, aad);
        if (encrypted.length > MAX_FRAME_CONTAINER)
          throw new Error('ARTIFACT_FRAME_TOO_LARGE');
        const prefix = Buffer.alloc(4);
        prefix.writeUInt32BE(encrypted.length);
        await file.write(prefix, 0, 4, position);
        position += 4;
        await file.write(encrypted, 0, encrypted.length, position);
        position += encrypted.length;
        total += plain.length;
        frameCount++;
        hash.update(plain);
      };
      for await (const raw of input.stream) {
        assertLive(input.signal);
        const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
        let at = 0;
        while (at < chunk.length) {
          const take = Math.min(FRAME - pending.length, chunk.length - at);
          pending = pending.length
            ? Buffer.concat([pending, chunk.subarray(at, at + take)])
            : Buffer.from(chunk.subarray(at, at + take));
          at += take;
          if (pending.length === FRAME) {
            await emit(pending);
            pending = Buffer.alloc(0);
          }
        }
      }
      if (pending.length) await emit(pending);
      if (
        total !== input.sizeBytes ||
        hash.digest('hex') !== input.sha256.toLowerCase()
      )
        throw new Error('ARTIFACT_SOURCE_INTEGRITY_FAILED');
      const descriptor: ArtifactDescriptor = {
        artifactId: input.artifactId,
        jobId: input.jobId,
        accountId: input.accountId,
        appId: input.appId,
        attempt: input.attempt,
        expiresAt: input.expiresAt,
        sizeBytes: total,
        sha256: input.sha256.toLowerCase(),
        frameCount,
        framingVersion: 1,
      };
      await file.sync();
      await file.close();
      const verifyFile = await open(
        tempPath,
        constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)
      );
      this.ownFile(input.accountId, verifyFile);
      const verifyPath = join(root, `.verified${randomUUID()}`);
      const verifySpool = await open(
        verifyPath,
        constants.O_WRONLY |
          constants.O_CREAT |
          constants.O_EXCL |
          (constants.O_NOFOLLOW ?? 0),
        0o600
      );
      this.ownFile(input.accountId, verifySpool);
      try {
        await unlink(verifyPath);
        await this.decryptAndVerify(
          verifyFile,
          verifySpool,
          descriptor,
          input.signal
        );
        await verifySpool.sync();
      } finally {
        await verifyFile.close();
        await verifySpool.close();
        try {
          await unlink(verifyPath);
        } catch {
          /* already unlinked */
        }
      }
      if (Date.parse(input.expiresAt) <= this.now())
        throw new Error('ARTIFACT_EXPIRED');
      await assertCurrent(input.assertCurrent);
      try {
        const commit = async () => {
          await link(tempPath, finalPath);
          published = true;
        };
        if (input.withCurrentLease) await input.withCurrentLease(commit);
        else await commit();
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST')
          throw new Error('ARTIFACT_ALREADY_EXISTS');
        throw error;
      }
      await unlink(tempPath);
      const dir = await open(root, constants.O_RDONLY);
      try {
        await dir.sync();
      } finally {
        await dir.close();
      }
      await assertCurrent(input.assertCurrent);
      if (Date.parse(input.expiresAt) <= this.now())
        throw new Error('ARTIFACT_EXPIRED');
      return Object.freeze(descriptor);
    } catch (error) {
      const cleanupErrors: unknown[] = [];
      try {
        await file.close();
      } catch (failure) {
        cleanupErrors.push(failure);
      }
      for (const path of [tempPath, ...(published ? [finalPath] : [])]) {
        try {
          await unlink(path);
        } catch (failure) {
          if ((failure as NodeJS.ErrnoException).code !== 'ENOENT')
            cleanupErrors.push(failure);
        }
      }
      if (cleanupErrors.length)
        throw new Error('ARTIFACT_STORE_CLEANUP_FAILED');
      throw error;
    }
  }

  private async openVerifiedCurrent(
    descriptor: ArtifactDescriptor,
    options: OpenArtifactOptions = {}
  ): Promise<VerifiedArtifact> {
    descriptor = Object.freeze({ ...descriptor });
    validateDescriptor(descriptor);
    if (Date.parse(descriptor.expiresAt) <= this.now())
      throw new Error('ARTIFACT_EXPIRED');
    assertLive(options.signal);
    await assertCurrent(options.assertCurrent);
    const root = await this.ensureRoot();
    const path = join(root, descriptor.artifactId);
    const handle = await open(
      path,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)
    );
    this.ownFile(descriptor.accountId, handle);
    let spoolPath: string | undefined;
    let spool: Awaited<ReturnType<typeof open>> | undefined;
    try {
      const st = await handle.stat();
      if (!st.isFile()) throw new Error('ARTIFACT_FILE_INVALID');
      spoolPath = join(root, `.verified${randomUUID()}`);
      spool = await open(
        spoolPath,
        constants.O_RDWR |
          constants.O_CREAT |
          constants.O_EXCL |
          (constants.O_NOFOLLOW ?? 0),
        0o600
      );
      this.ownFile(descriptor.accountId, spool);
      await unlink(spoolPath);
      await this.decryptAndVerify(handle, spool, descriptor, options.signal);
      await spool.sync();
      await handle.close();
      if (Date.parse(descriptor.expiresAt) <= this.now())
        throw new Error('ARTIFACT_EXPIRED');
      assertLive(options.signal);
      await assertCurrent(options.assertCurrent);
      let cleaned = false;
      let cleanupDone = false;
      return {
        sizeBytes: descriptor.sizeBytes,
        createReadStream: (start = 0, endExclusive = descriptor.sizeBytes) => {
          if (cleaned) throw new Error('ARTIFACT_CLOSED');
          if (
            !Number.isSafeInteger(start) ||
            !Number.isSafeInteger(endExclusive) ||
            start < 0 ||
            endExclusive < start ||
            endExclusive > descriptor.sizeBytes
          )
            throw new RangeError('ARTIFACT_RANGE_INVALID');
          if (endExclusive === start) return Readable.from([]);
          return require('node:fs').createReadStream('', {
            fd: spool!.fd,
            autoClose: false,
            start,
            end: endExclusive - 1,
          });
        },
        readChunk: async (offset, length) => {
          if (cleaned) throw new Error('ARTIFACT_CLOSED');
          if (
            !Number.isSafeInteger(offset) ||
            !Number.isSafeInteger(length) ||
            offset < 0 ||
            length < 0 ||
            length > FRAME ||
            offset + length > descriptor.sizeBytes
          )
            throw new RangeError('ARTIFACT_RANGE_INVALID');
          const b = Buffer.alloc(length);
          const { bytesRead } = await spool!.read(b, 0, length, offset);
          if (bytesRead !== length) throw new Error('ARTIFACT_SPOOL_TRUNCATED');
          return b;
        },
        cleanup: async () => {
          if (cleanupDone) return;
          cleaned = true;
          await spool!.close();
          cleanupDone = true;
        },
      };
    } catch (error) {
      try {
        await handle.close();
      } catch {
        /* closed */
      }
      try {
        await spool?.close();
      } catch {
        /* closed */
      }
      if (spoolPath)
        try {
          await unlink(spoolPath);
        } catch {
          /* absent */
        }
      throw error;
    }
  }

  async custodyProbe(nonce: string, mode: CustodyProbeMode): Promise<string> {
    return localCustodyProbe(await this.ensureRoot(), nonce, mode);
  }

  async custodyIdentity(): Promise<string> {
    return localCustodyIdentity(await this.ensureRoot());
  }

  async remove(
    descriptor: ArtifactDescriptor,
    authorizeIncomplete?: () => Promise<boolean>
  ): Promise<void> {
    descriptor = Object.freeze({ ...descriptor });
    validateDescriptor(descriptor);
    const root = await this.ensureRoot();
    for (const leaf of [
      descriptor.artifactId,
      `.pending${descriptor.artifactId}`,
    ]) {
      const path = join(root, leaf);
      let handle: Awaited<ReturnType<typeof open>>;
      try {
        handle = await open(
          path,
          constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)
        );
        this.ownFile(descriptor.accountId, handle);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
        throw error;
      }
      try {
        if (!(await handle.stat()).isFile())
          throw new Error('ARTIFACT_FILE_INVALID');
        try {
          await this.verifyFirstFrame(handle, descriptor);
        } catch (error) {
          if (!authorizeIncomplete || !(await authorizeIncomplete()))
            throw error;
        }
      } finally {
        await handle.close();
      }
      try {
        await unlink(path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
  }

  async inspectAbsent(artifactId: string): Promise<boolean> {
    if (!UUID.test(artifactId)) throw new Error('ARTIFACT_ID_INVALID');
    const root = await this.ensureRoot();
    for (const name of [artifactId, `.pending${artifactId}`]) {
      try {
        await lstat(join(root, name));
        return false;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    return true;
  }

  /** Only a trusted ledger owner may purge corrupt ciphertext, under its locked row authority. */
  async purgeOwnedArtifact(
    descriptor: ArtifactDescriptor,
    assertAuthorized: () => Promise<boolean>
  ): Promise<void> {
    descriptor = Object.freeze({ ...descriptor });
    validateDescriptor(descriptor);
    if (!(await assertAuthorized()))
      throw new Error('ARTIFACT_PURGE_NOT_AUTHORIZED');
    const root = await this.ensureRoot();
    for (const name of [
      descriptor.artifactId,
      `.pending${descriptor.artifactId}`,
    ]) {
      const path = join(root, name);
      try {
        const st = await lstat(path);
        if (!st.isFile() || st.isSymbolicLink())
          throw new Error('ARTIFACT_FILE_INVALID');
        if (!(await assertAuthorized()))
          throw new Error('ARTIFACT_PURGE_NOT_AUTHORIZED');
        await unlink(path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    const directory = await open(root, constants.O_RDONLY);
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
    if (!(await this.inspectAbsent(descriptor.artifactId)))
      throw new Error('ARTIFACT_PURGE_READBACK_FAILED');
  }

  async sweepExpiredTemps(deadlineMs: number): Promise<void> {
    if (!Number.isFinite(deadlineMs))
      throw new Error('ARTIFACT_SWEEP_DEADLINE_INVALID');
    const root = await this.ensureRoot();
    for (const name of await readdir(root)) {
      if (
        !/^\.pending[0-9a-f-]{36}$/i.test(name) &&
        !/^\.ot-store-probe-[0-9a-f-]{36}$/i.test(name)
      )
        continue;
      const path = join(root, name);
      try {
        const st = await lstat(path);
        if (st.isFile() && !st.isSymbolicLink() && st.mtimeMs < deadlineMs)
          await unlink(path);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      }
    }
  }

  private async ensureRoot(): Promise<string> {
    try {
      await mkdir(this.options.root, { recursive: true, mode: 0o700 });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    }
    const st = await lstat(this.options.root);
    if (!st.isDirectory() || st.isSymbolicLink())
      throw new Error('ARTIFACT_ROOT_INVALID');
    if (
      (st.mode & 0o077) !== 0 ||
      (typeof process.getuid === 'function' && st.uid !== process.getuid())
    )
      throw new Error('ARTIFACT_ROOT_NOT_PRIVATE');
    return this.options.root;
  }

  private async decryptAndVerify(
    file: Awaited<ReturnType<typeof open>>,
    spool: Awaited<ReturnType<typeof open>>,
    d: ArtifactDescriptor,
    signal?: AbortSignal
  ): Promise<void> {
    const st = await file.stat();
    let pos = MAGIC.length + 16;
    const magic = Buffer.alloc(MAGIC.length);
    await readExact(file, magic, 0);
    const id = Buffer.alloc(16);
    await readExact(file, id, MAGIC.length);
    if (
      !magic.equals(MAGIC) ||
      id.toString('hex') !== d.artifactId.replace(/-/g, '').toLowerCase()
    )
      throw new Error('ARTIFACT_FORMAT_INVALID');
    let total = 0;
    const hash = createHash('sha256');
    for (let i = 0; i < d.frameCount; i++) {
      assertLive(signal);
      const prefix = Buffer.alloc(4);
      await readExact(file, prefix, pos);
      pos += 4;
      const n = prefix.readUInt32BE();
      if (n <= 0 || n > MAX_FRAME_CONTAINER || pos + n > st.size)
        throw new Error('ARTIFACT_FRAME_INVALID');
      const container = Buffer.alloc(n);
      await readExact(file, container, pos);
      pos += n;
      const plain = this.encryption.decrypt(container);
      if (
        !this.encryption.isEnvelope(container) ||
        this.encryption.readAssociatedData(container) !== frameAad(d, i) ||
        plain.length < 1 ||
        plain.length > FRAME ||
        (i < d.frameCount - 1 && plain.length !== FRAME)
      )
        throw new Error('ARTIFACT_FRAME_BINDING_INVALID');
      total += plain.length;
      if (total > d.sizeBytes) throw new Error('ARTIFACT_SIZE_INVALID');
      hash.update(plain);
      await spool.write(plain, 0, plain.length, total - plain.length);
    }
    if (
      pos !== st.size ||
      total !== d.sizeBytes ||
      hash.digest('hex') !== d.sha256.toLowerCase()
    )
      throw new Error('ARTIFACT_INTEGRITY_FAILED');
  }

  private async verifyFirstFrame(
    file: Awaited<ReturnType<typeof open>>,
    d: ArtifactDescriptor
  ): Promise<void> {
    const magic = Buffer.alloc(MAGIC.length);
    await readExact(file, magic, 0);
    const id = Buffer.alloc(16);
    await readExact(file, id, MAGIC.length);
    if (
      !magic.equals(MAGIC) ||
      id.toString('hex') !== d.artifactId.replace(/-/g, '').toLowerCase()
    )
      throw new Error('ARTIFACT_FORMAT_INVALID');
    const headerEnd = MAGIC.length + 16;
    const prefix = Buffer.alloc(4);
    await readExact(file, prefix, headerEnd);
    const n = prefix.readUInt32BE();
    if (!n || n > MAX_FRAME_CONTAINER)
      throw new Error('ARTIFACT_FRAME_INVALID');
    const container = Buffer.alloc(n);
    await readExact(file, container, headerEnd + 4);
    const p = this.encryption.decrypt(container);
    if (
      this.encryption.readAssociatedData(container) !== frameAad(d, 0) ||
      !p.length
    )
      throw new Error('ARTIFACT_FRAME_BINDING_INVALID');
  }
}

async function readExact(
  h: Awaited<ReturnType<typeof open>>,
  b: Buffer,
  position: number
): Promise<void> {
  let got = 0;
  while (got < b.length) {
    const r = await h.read(b, got, b.length - got, position + got);
    if (!r.bytesRead) throw new Error('ARTIFACT_TRUNCATED');
    got += r.bytesRead;
  }
}
function frameAad(
  d: Pick<
    ArtifactDescriptor,
    'artifactId' | 'accountId' | 'jobId' | 'appId' | 'attempt'
  >,
  frame: number
): string {
  const canonical = JSON.stringify({
    artifactId: d.artifactId,
    accountId: d.accountId,
    jobId: d.jobId,
    appId: d.appId,
    attempt: d.attempt,
    frame,
  });
  return createHash('sha256').update(canonical).digest('hex');
}
function assertLive(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('ARTIFACT_ABORTED');
}
async function assertCurrent(check?: () => Promise<boolean>): Promise<void> {
  if (check && !(await check())) throw new Error('ARTIFACT_LEASE_LOST');
}
function validateInput(i: PutArtifactInput): void {
  if (
    !UUID.test(i.artifactId) ||
    !UUID.test(i.jobId) ||
    !UUID.test(i.accountId) ||
    !APPS.has(i.appId) ||
    !Number.isSafeInteger(i.attempt) ||
    i.attempt < 1 ||
    !Number.isFinite(Date.parse(i.expiresAt)) ||
    !Number.isSafeInteger(i.sizeBytes) ||
    i.sizeBytes < 1 ||
    i.sizeBytes > MAX_ARTIFACT ||
    !HASH.test(i.sha256)
  )
    throw new Error('ARTIFACT_DESCRIPTOR_INVALID');
}
function validateDescriptor(d: ArtifactDescriptor): void {
  validateInput({ ...d, stream: Readable.from([]) });
  if (
    d.framingVersion !== 1 ||
    !Number.isSafeInteger(d.frameCount) ||
    d.frameCount < 1 ||
    d.frameCount !== Math.ceil(d.sizeBytes / FRAME)
  )
    throw new Error('ARTIFACT_DESCRIPTOR_INVALID');
}
