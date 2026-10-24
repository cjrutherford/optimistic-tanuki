import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  AccountExportArtifactStoreService,
  ArtifactDescriptor,
  VerifiedArtifact,
} from '@optimistic-tanuki/storage';
import { createHash, randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { AppService } from '../app/app.service';
import { AccountExportJobEntity } from './entities/account-export-job.entity';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const APPS = new Set(['client-interface', 'local-hub']);
const TTL_MS = 60_000;
const MAX_PER_ACCOUNT = 2;
const MAX_PROCESS = 8;
const MAX_READ = 65_536;

interface RequestContext {
  accountId: string;
  appId: 'client-interface' | 'local-hub';
  token: string;
  jobId: string;
}
interface Capability {
  id: string;
  accountId: string;
  sessionHash: string;
  expiresAtMs: number;
  handle: VerifiedArtifact;
  descriptor: ArtifactDescriptor;
  serial: Promise<void>;
}

@Injectable()
export class AccountExportDownloadService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly capabilities = new Map<string, Capability>();
  private readonly opening = new Map<string, number>();
  private closing = false;
  private sweepTimer?: ReturnType<typeof setInterval>;

  constructor(
    @Inject(getRepositoryToken(AccountExportJobEntity))
    private readonly jobs: Repository<AccountExportJobEntity>,
    private readonly store: AccountExportArtifactStoreService,
    private readonly auth: AppService
  ) {}

  onModuleInit(): void {
    this.sweepTimer = setInterval(
      () => void this.sweep().catch(() => undefined),
      5_000
    );
    this.sweepTimer.unref?.();
  }

  async onModuleDestroy(): Promise<void> {
    this.closing = true;
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    this.sweepTimer = undefined;
    await Promise.all(
      [...this.capabilities.values()].map((cap) => this.destroy(cap))
    );
  }

  async open(request: unknown): Promise<{
    downloadId: string;
    fileName: 'account-export.tar';
    mimeType: 'application/x-tar';
    sizeBytes: number;
    sha256: string;
    expiresAt: string;
  }> {
    const input = this.context(request);
    await this.authorize(input);
    const job = await this.findJob(input);
    const descriptor = this.readyDescriptor(job, input);
    this.enforceCapacity(input.accountId);
    this.opening.set(
      input.accountId,
      (this.opening.get(input.accountId) ?? 0) + 1
    );
    let handle: VerifiedArtifact | undefined;
    try {
      handle = await this.store.openVerified(descriptor);
      await this.authorize(input);
      const current = this.readyDescriptor(await this.findJob(input), input);
      if (this.closing || !sameDescriptor(current, descriptor))
        throw new Error('UNAVAILABLE');
      const expiresAtMs = Math.min(
        Date.now() + TTL_MS,
        Date.parse(descriptor.expiresAt)
      );
      if (expiresAtMs <= Date.now()) throw new Error('EXPIRED');
      const id = randomUUID();
      const capability: Capability = {
        id,
        accountId: input.accountId,
        sessionHash: sessionHash(
          input.token,
          input.accountId,
          input.appId,
          input.jobId
        ),
        expiresAtMs,
        handle,
        descriptor,
        serial: Promise.resolve(),
      };
      this.capabilities.set(id, capability);
      handle = undefined;
      return {
        downloadId: id,
        fileName: 'account-export.tar',
        mimeType: 'application/x-tar',
        sizeBytes: descriptor.sizeBytes,
        sha256: descriptor.sha256,
        expiresAt: new Date(expiresAtMs).toISOString(),
      };
    } catch {
      if (handle) await handle.cleanup();
      return this.deny('EXPORT_DOWNLOAD_UNAVAILABLE');
    } finally {
      const remaining = (this.opening.get(input.accountId) ?? 1) - 1;
      if (remaining) this.opening.set(input.accountId, remaining);
      else this.opening.delete(input.accountId);
    }
  }

  async read(
    request: unknown
  ): Promise<{ bytesBase64: string; offset: number; eof: boolean }> {
    const input = this.context(request);
    const id = isRecord(request) ? request['downloadId'] : undefined;
    const offset = isRecord(request) ? request['offset'] : undefined;
    const length = isRecord(request) ? request['length'] : undefined;
    if (
      !isUuid(id) ||
      !Number.isSafeInteger(offset) ||
      (offset as number) < 0 ||
      !Number.isSafeInteger(length) ||
      (length as number) < 1 ||
      (length as number) > MAX_READ
    )
      return this.deny('EXPORT_DOWNLOAD_RANGE_INVALID');
    const cap = this.capabilities.get(id);
    if (
      !cap ||
      cap.accountId !== input.accountId ||
      cap.expiresAtMs <= Date.now() ||
      cap.sessionHash !==
        sessionHash(input.token, input.accountId, input.appId, input.jobId)
    ) {
      if (cap && cap.expiresAtMs <= Date.now()) await this.destroy(cap);
      return this.deny('EXPORT_DOWNLOAD_NOT_FOUND');
    }
    return this.serial(cap, async () => {
      try {
        await this.authorize(input);
        const job = await this.findJob(input);
        const current = this.readyDescriptor(job, input);
        if (
          this.capabilities.get(cap.id) !== cap ||
          cap.expiresAtMs <= Date.now() ||
          !sameDescriptor(current, cap.descriptor) ||
          (offset as number) + (length as number) > current.sizeBytes
        )
          return this.deny('EXPORT_DOWNLOAD_RANGE_INVALID');
        const bytes = await cap.handle.readChunk(
          offset as number,
          length as number
        );
        return {
          bytesBase64: bytes.toString('base64'),
          offset: offset as number,
          eof: (offset as number) + bytes.length === current.sizeBytes,
        };
      } catch {
        await this.destroy(cap);
        return this.deny('EXPORT_DOWNLOAD_NOT_AUTHORIZED');
      }
    });
  }

  async close(request: unknown): Promise<void> {
    const id = isRecord(request) ? request['downloadId'] : undefined;
    if (!isUuid(id)) return this.deny('EXPORT_DOWNLOAD_NOT_FOUND');
    const input = this.context(request);
    const cap = this.capabilities.get(id);
    if (
      !cap ||
      cap.accountId !== input.accountId ||
      cap.sessionHash !==
        sessionHash(input.token, input.accountId, input.appId, input.jobId)
    )
      return this.deny('EXPORT_DOWNLOAD_NOT_FOUND');
    await this.destroy(cap);
  }

  async invalidateJob(jobId: string): Promise<void> {
    if (!isUuid(jobId)) return this.deny('EXPORT_DOWNLOAD_NOT_FOUND');
    await Promise.all(
      [...this.capabilities.values()]
        .filter((cap) => cap.descriptor.jobId === jobId)
        .map((cap) => this.destroy(cap))
    );
  }

  private context(value: unknown): RequestContext {
    if (
      !isRecord(value) ||
      !isUuid(value['accountId']) ||
      typeof value['appId'] !== 'string' ||
      !APPS.has(value['appId']) ||
      typeof value['token'] !== 'string' ||
      value['token'].length < 1 ||
      value['token'].length > 16_384 ||
      !isUuid(value['jobId'])
    )
      return this.deny('EXPORT_DOWNLOAD_NOT_AUTHORIZED');
    return value as unknown as RequestContext;
  }

  private async authorize(input: RequestContext): Promise<unknown> {
    try {
      const result = await this.auth.validateToken(input.token, input.appId);
      if (
        result?.isValid !== true ||
        result.data?.userId !== input.accountId ||
        result.data?.appId !== input.appId
      )
        return this.deny('EXPORT_DOWNLOAD_NOT_AUTHORIZED');
      return result;
    } catch {
      return this.deny('EXPORT_DOWNLOAD_NOT_AUTHORIZED');
    }
  }

  private async findJob(
    input: RequestContext
  ): Promise<AccountExportJobEntity> {
    const job = await this.jobs.findOne({
      where: {
        id: input.jobId,
        accountId: input.accountId,
        appId: input.appId,
        kind: 'export',
      },
    });
    if (!job) return this.deny('EXPORT_DOWNLOAD_NOT_FOUND');
    return job;
  }

  private readyDescriptor(
    job: AccountExportJobEntity,
    input: RequestContext
  ): ArtifactDescriptor {
    const summary = job.coverageSummary as Record<string, unknown> | undefined;
    const coverage = summary?.['captureCoverage'];
    if (
      job.state !== 'complete' ||
      summary?.['artifactState'] !== 'verified' ||
      summary?.['artifactAvailable'] !== true ||
      !isRecord(coverage) ||
      coverage['complete'] !== true
    )
      return this.deny('EXPORT_DOWNLOAD_NOT_READY');
    const d = summary?.['privateArtifact'];
    if (
      !isDescriptor(d) ||
      d.jobId !== job.id ||
      d.accountId !== job.accountId ||
      d.appId !== job.appId ||
      d.attempt !== job.attempt ||
      d.expiresAt <= new Date().toISOString()
    )
      return this.deny('EXPORT_DOWNLOAD_NOT_READY');
    return d;
  }

  private enforceCapacity(accountId: string): void {
    const own = [...this.capabilities.values()].filter(
      (cap) => cap.accountId === accountId
    );
    const pending = [...this.opening.values()].reduce(
      (total, count) => total + count,
      0
    );
    if (
      this.closing ||
      this.capabilities.size + pending >= MAX_PROCESS ||
      own.length + (this.opening.get(accountId) ?? 0) >= MAX_PER_ACCOUNT
    )
      this.deny('EXPORT_DOWNLOAD_CAPACITY');
  }

  private async serial<T>(
    cap: Capability,
    action: () => Promise<T>
  ): Promise<T> {
    let release!: () => void;
    const previous = cap.serial;
    cap.serial = new Promise<void>((resolve) => (release = resolve));
    await previous;
    try {
      return await action();
    } finally {
      release();
    }
  }

  private async destroy(cap: Capability): Promise<void> {
    if (this.capabilities.get(cap.id) !== cap) return;
    cap.expiresAtMs = 0;
    try {
      await cap.handle.cleanup();
    } catch {
      return this.deny('EXPORT_DOWNLOAD_CLEANUP_FAILED');
    }
    this.capabilities.delete(cap.id);
  }

  private async sweep(): Promise<void> {
    const expired = [...this.capabilities.values()].filter(
      (cap) => cap.expiresAtMs <= Date.now()
    );
    await Promise.all(expired.map((cap) => this.destroy(cap)));
  }

  private deny<T = never>(code: string): T {
    throw new RpcException({
      statusCode: 403,
      code,
      message: 'Export download is unavailable',
    });
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}
function isDescriptor(value: unknown): value is ArtifactDescriptor {
  if (!isRecord(value)) return false;
  return (
    isUuid(value['artifactId']) &&
    isUuid(value['jobId']) &&
    isUuid(value['accountId']) &&
    APPS.has(value['appId']) &&
    Number.isSafeInteger(value['attempt']) &&
    value['attempt'] >= 1 &&
    typeof value['expiresAt'] === 'string' &&
    ISO_DATE.test(value['expiresAt']) &&
    Number.isFinite(Date.parse(value['expiresAt'])) &&
    new Date(value['expiresAt']).toISOString() === value['expiresAt'] &&
    Number.isSafeInteger(value['sizeBytes']) &&
    value['sizeBytes'] > 0 &&
    /^[a-f0-9]{64}$/i.test(value['sha256']) &&
    Number.isSafeInteger(value['frameCount']) &&
    value['frameCount'] === Math.ceil(value['sizeBytes'] / MAX_READ) &&
    value['framingVersion'] === 1
  );
}
function sameDescriptor(a: ArtifactDescriptor, b: ArtifactDescriptor): boolean {
  return (
    a.artifactId === b.artifactId &&
    a.jobId === b.jobId &&
    a.accountId === b.accountId &&
    a.appId === b.appId &&
    a.attempt === b.attempt &&
    a.expiresAt === b.expiresAt &&
    a.sizeBytes === b.sizeBytes &&
    a.sha256 === b.sha256 &&
    a.frameCount === b.frameCount &&
    a.framingVersion === b.framingVersion
  );
}
function sessionHash(
  token: string,
  accountId: string,
  appId: string,
  jobId: string
): string {
  return createHash('sha256')
    .update(token)
    .update('\0')
    .update(accountId)
    .update('\0')
    .update(appId)
    .update('\0')
    .update(jobId)
    .digest('hex');
}
