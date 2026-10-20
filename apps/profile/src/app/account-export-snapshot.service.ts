import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import {
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
  AccountExportSnapshotIdentityPage,
  AccountExportSnapshotIdentityRequest,
  AccountExportSnapshotReadRequest,
  AccountExportSnapshotReadResult,
  AccountExportSnapshotRequest,
  ACCOUNT_EXPORT_SNAPSHOT_LIMITS,
  isAccountExportCaptureGrant,
} from '@optimistic-tanuki/models';
import {
  AccountExportOwnerSpoolService,
  OwnerSpoolHandle,
} from '@optimistic-tanuki/storage';
import { AuthCommands } from '@optimistic-tanuki/constants';
import { firstValueFrom, timeout } from 'rxjs';
import { randomUUID } from 'node:crypto';
import {
  PROFILE_ACCOUNT_EXPORT_SOURCES,
  ProfileAccountExportOwnerService,
  ProfileAccountExportSource,
} from './account-export-owner.service';

const AUTH_TIMEOUT_MS = 3000;
const CAPTURE_TIMEOUT_MS = 45_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type IdentityIndexPage = {
  offset: number;
  byteLength: number;
  start: number;
  count: number;
};
type Entry = {
  handleId: string;
  grantScope: Pick<
    AccountExportCaptureGrant,
    'accountId' | 'appId' | 'jobId' | 'attempt' | 'leaseOwner'
  >;
  spool: OwnerSpoolHandle<ProfileAccountExportSource>;
  identityPages: IdentityIndexPage[];
  identityCount: number;
  expiresAtMs: number;
  timer?: NodeJS.Timeout;
  reservedBytes: number;
  retired: boolean;
  cleanupPromise?: Promise<void>;
};

export class ProfileAccountExportSnapshotError extends RpcException {
  constructor(readonly code: string) {
    super({ code });
    this.name = 'ProfileAccountExportSnapshotError';
  }
}

@Injectable()
export class ProfileAccountExportSnapshotService implements OnModuleDestroy {
  private readonly entries = new Map<string, Entry>();
  private readonly opening = new Set<AbortController>();
  private openingDrained?: () => void;
  private reservedBytes = 0;
  private closing = false;

  constructor(
    private readonly owner: ProfileAccountExportOwnerService,
    private readonly spoolService: AccountExportOwnerSpoolService,
    private readonly authClient: ClientProxy
  ) {}

  async open(grantValue: unknown): Promise<AccountExportSnapshotDescriptor> {
    if (this.closing) {
      throw new ProfileAccountExportSnapshotError('OWNER_SNAPSHOT_CLOSED');
    }
    const grant = this.grant(grantValue);
    await this.assertLease(grant);
    if (this.closing) {
      throw new ProfileAccountExportSnapshotError('OWNER_SNAPSHOT_CLOSED');
    }
    if (
      this.entries.size + this.opening.size >=
        ACCOUNT_EXPORT_SNAPSHOT_LIMITS.entries ||
      this.reservedBytes + ACCOUNT_EXPORT_SNAPSHOT_LIMITS.captureBytes >
        ACCOUNT_EXPORT_SNAPSHOT_LIMITS.aggregateBytes
    ) {
      throw new ProfileAccountExportSnapshotError('OWNER_SNAPSHOT_CAPACITY');
    }
    this.reservedBytes += ACCOUNT_EXPORT_SNAPSHOT_LIMITS.captureBytes;
    const controller = new AbortController();
    this.opening.add(controller);
    let spool: OwnerSpoolHandle<ProfileAccountExportSource> | undefined;
    let controlledFailureCode: string | undefined;
    try {
      const identityPages: IdentityIndexPage[] = [];
      let stagedOffset = 0;
      let identityCount = 0;
      spool = await this.spoolService.capture<ProfileAccountExportSource>(
        {
          participantId: 'profile',
          accountId: grant.accountId,
          sources: PROFILE_ACCOUNT_EXPORT_SOURCES,
          maxBytes: ACCOUNT_EXPORT_SNAPSHOT_LIMITS.captureBytes,
          timeoutMs: CAPTURE_TIMEOUT_MS,
          signal: controller.signal,
        },
        async (onChunk, spoolSignal) =>
          this.owner.captureAccount({
            accountId: grant.accountId,
            sessionToken: grant.token,
            appId: grant.appId,
            captureTimeoutMs: CAPTURE_TIMEOUT_MS,
            signal: spoolSignal,
            onChunk: async (chunk) => {
              try {
                await this.assertLease(grant);
              } catch (error) {
                controlledFailureCode = 'OWNER_AUTHORIZATION_FAILED';
                throw error;
              }
              if (controller.signal.aborted || this.closing) {
                controlledFailureCode = 'OWNER_CAPTURE_ABORTED';
                throw new ProfileAccountExportSnapshotError(
                  'OWNER_CAPTURE_ABORTED'
                );
              }
              const line = Buffer.from(`${JSON.stringify(chunk)}\n`, 'utf8');
              if (chunk.source === 'profileIdentity') {
                if (chunk.records.length > 0) {
                  if (
                    identityPages.length >=
                    ACCOUNT_EXPORT_SNAPSHOT_LIMITS.identityPages
                  ) {
                    throw new ProfileAccountExportSnapshotError(
                      'OWNER_SNAPSHOT_IDENTITY_LIMIT'
                    );
                  }
                  for (const record of chunk.records) {
                    const id = record.data?.id;
                    if (
                      typeof id !== 'string' ||
                      !UUID_PATTERN.test(id) ||
                      record.data?.userId !== grant.accountId
                    ) {
                      throw new ProfileAccountExportSnapshotError(
                        'OWNER_READ_FAILED'
                      );
                    }
                  }
                  identityPages.push({
                    offset: stagedOffset,
                    byteLength: line.length,
                    start: identityCount,
                    count: chunk.records.length,
                  });
                  identityCount += chunk.records.length;
                }
              }
              stagedOffset += line.length;
              await onChunk(chunk);
            },
          })
      );
      const metadata = spool.metadata;
      if (
        metadata.participantId !== 'profile' ||
        metadata.accountId !== grant.accountId ||
        metadata.sizeBytes !== stagedOffset ||
        metadata.sourceRowCounts.profileIdentity !== identityCount ||
        metadata.sourceRowCounts.profile !== identityCount ||
        !Number.isSafeInteger(identityCount)
      ) {
        throw new ProfileAccountExportSnapshotError('OWNER_READ_FAILED');
      }
      await this.assertLease(grant);
      if (controller.signal.aborted || this.closing) {
        throw new ProfileAccountExportSnapshotError('OWNER_CAPTURE_ABORTED');
      }
      const handleId = randomUUID();
      const now = Date.now();
      const expiresAtMs = now + ACCOUNT_EXPORT_SNAPSHOT_LIMITS.ttlMs;
      const entry: Entry = {
        handleId,
        grantScope: {
          accountId: grant.accountId,
          appId: grant.appId,
          jobId: grant.jobId,
          attempt: grant.attempt,
          leaseOwner: grant.leaseOwner,
        },
        spool,
        identityPages,
        identityCount,
        expiresAtMs,
        timer: setTimeout(
          () => void this.expire(handleId).catch(() => undefined),
          ACCOUNT_EXPORT_SNAPSHOT_LIMITS.ttlMs
        ),
        reservedBytes: metadata.sizeBytes,
        retired: false,
      };
      entry.timer.unref?.();
      const descriptor = this.descriptor(entry);
      this.reservedBytes -=
        ACCOUNT_EXPORT_SNAPSHOT_LIMITS.captureBytes - metadata.sizeBytes;
      this.entries.set(handleId, entry);
      spool = undefined;
      this.closeOpening(controller);
      return descriptor;
    } catch (error) {
      let cleanupFailed = false;
      if (spool) {
        try {
          await spool.cleanup();
          this.reservedBytes -= ACCOUNT_EXPORT_SNAPSHOT_LIMITS.captureBytes;
        } catch {
          cleanupFailed = true;
          const retired = this.retiredEntry(
            grant,
            spool,
            ACCOUNT_EXPORT_SNAPSHOT_LIMITS.captureBytes
          );
          this.entries.set(retired.handleId, retired);
          retired.timer = setTimeout(
            () => void this.expire(retired.handleId).catch(() => undefined),
            1000
          );
          retired.timer.unref?.();
        }
      } else {
        this.reservedBytes -= ACCOUNT_EXPORT_SNAPSHOT_LIMITS.captureBytes;
      }
      this.closeOpening(controller);
      if (cleanupFailed) {
        throw new ProfileAccountExportSnapshotError(
          'OWNER_SNAPSHOT_CLEANUP_FAILED'
        );
      }
      if (error instanceof ProfileAccountExportSnapshotError) throw error;
      if (controlledFailureCode) {
        throw new ProfileAccountExportSnapshotError(controlledFailureCode);
      }
      throw new ProfileAccountExportSnapshotError('OWNER_CAPTURE_FAILED');
    }
  }

  async read(requestValue: unknown): Promise<AccountExportSnapshotReadResult> {
    const request = this.readRequest(requestValue);
    const entry = this.findEntry(request);
    await this.assertLease(request);
    this.assertLive(entry);
    if (
      !Number.isSafeInteger(request.offset) ||
      request.offset < 0 ||
      request.offset > entry.spool.metadata.sizeBytes ||
      !Number.isSafeInteger(request.length) ||
      request.length < 1 ||
      request.length > ACCOUNT_EXPORT_SNAPSHOT_LIMITS.readBytes
    ) {
      throw new ProfileAccountExportSnapshotError(
        'OWNER_SNAPSHOT_INVALID_RANGE'
      );
    }
    const length = Math.min(
      request.length,
      entry.spool.metadata.sizeBytes - request.offset
    );
    const bytes =
      length === 0
        ? Buffer.alloc(0)
        : await entry.spool.readChunk(request.offset, length);
    this.assertLive(entry);
    await this.assertLease(request);
    this.assertLive(entry);
    return {
      handleId: entry.handleId,
      captureId: entry.spool.metadata.captureId,
      offset: request.offset,
      bytesBase64: bytes.toString('base64'),
      eof: request.offset + bytes.length === entry.spool.metadata.sizeBytes,
    };
  }

  async readIdentities(
    requestValue: unknown
  ): Promise<AccountExportSnapshotIdentityPage> {
    const request = this.identityRequest(requestValue);
    const entry = this.findEntry(request);
    await this.assertLease(request);
    this.assertLive(entry);
    if (
      !Number.isSafeInteger(request.offset) ||
      request.offset < 0 ||
      request.offset > entry.identityCount ||
      !Number.isSafeInteger(request.limit) ||
      request.limit < 1 ||
      request.limit > ACCOUNT_EXPORT_SNAPSHOT_LIMITS.identityPageSize
    ) {
      throw new ProfileAccountExportSnapshotError(
        'OWNER_SNAPSHOT_INVALID_RANGE'
      );
    }
    const end = Math.min(entry.identityCount, request.offset + request.limit);
    const profileIds: string[] = [];
    let cursor = request.offset;
    while (cursor < end) {
      const page = entry.identityPages.find(
        (candidate) =>
          cursor >= candidate.start &&
          cursor < candidate.start + candidate.count
      );
      if (!page)
        throw new ProfileAccountExportSnapshotError('OWNER_READ_FAILED');
      const records = await this.readIdentityChunk(entry, page);
      const within = cursor - page.start;
      const take = Math.min(end - cursor, page.count - within);
      for (let i = within; i < within + take; i++) {
        const id = records[i]?.data?.id;
        if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
          throw new ProfileAccountExportSnapshotError('OWNER_READ_FAILED');
        }
        profileIds.push(id);
      }
      cursor += take;
    }
    this.assertLive(entry);
    await this.assertLease(request);
    this.assertLive(entry);
    return {
      handleId: entry.handleId,
      captureId: entry.spool.metadata.captureId,
      accountId: entry.spool.metadata.accountId,
      snapshotAt: entry.spool.metadata.snapshotAt,
      profileIds,
      total: entry.identityCount,
      nextOffset: end < entry.identityCount ? end : null,
    };
  }

  async release(
    requestValue: unknown
  ): Promise<{ handleId: string; released: true }> {
    const request = this.request(requestValue);
    const entry = this.entries.get(request.handleId);
    if (entry && !this.matches(entry, request)) {
      throw new ProfileAccountExportSnapshotError('OWNER_SNAPSHOT_NOT_FOUND');
    }
    if (entry) await this.remove(entry);
    return { handleId: request.handleId, released: true };
  }

  async onModuleDestroy(): Promise<void> {
    this.closing = true;
    for (const controller of this.opening) controller.abort();
    if (this.opening.size > 0) {
      await new Promise<void>((resolve) => {
        this.openingDrained = resolve;
      });
    }
    const entries = [...this.entries.values()];
    await Promise.allSettled(entries.map((entry) => this.remove(entry)));
  }

  private async assertLease(grant: AccountExportCaptureGrant): Promise<void> {
    try {
      const result = await firstValueFrom(
        this.authClient
          .send(
            { cmd: AuthCommands.ValidateAccountExportLease },
            {
              accountId: grant.accountId,
              appId: grant.appId,
              token: grant.token,
              jobId: grant.jobId,
              attempt: grant.attempt,
              leaseOwner: grant.leaseOwner,
            }
          )
          .pipe(timeout(AUTH_TIMEOUT_MS))
      );
      if (
        !result ||
        typeof result !== 'object' ||
        Array.isArray(result) ||
        (result as { valid?: unknown }).valid !== true ||
        Object.keys(result).length !== 1
      ) {
        throw new Error('lease invalid');
      }
    } catch {
      throw new ProfileAccountExportSnapshotError('OWNER_AUTHORIZATION_FAILED');
    }
  }

  private grant(value: unknown): AccountExportCaptureGrant {
    if (!isAccountExportCaptureGrant(value)) {
      throw new ProfileAccountExportSnapshotError('OWNER_AUTHORIZATION_FAILED');
    }
    return {
      accountId: value.accountId,
      appId: value.appId,
      token: value.token,
      jobId: value.jobId,
      attempt: value.attempt,
      leaseOwner: value.leaseOwner,
    };
  }

  private request(value: unknown): AccountExportSnapshotRequest {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new ProfileAccountExportSnapshotError('OWNER_AUTHORIZATION_FAILED');
    }
    const source = value as Record<string, unknown>;
    const grant = this.grant(source);
    if (
      typeof source.handleId !== 'string' ||
      !UUID_PATTERN.test(source.handleId)
    ) {
      throw new ProfileAccountExportSnapshotError('OWNER_SNAPSHOT_NOT_FOUND');
    }
    return { ...grant, handleId: source.handleId };
  }

  private identityRequest(
    value: unknown
  ): AccountExportSnapshotIdentityRequest {
    const request = this.request(value);
    const source = value as Record<string, unknown>;
    return {
      ...request,
      offset: source.offset as number,
      limit: source.limit as number,
    };
  }

  private readRequest(value: unknown): AccountExportSnapshotReadRequest {
    const request = this.request(value);
    const source = value as Record<string, unknown>;
    return {
      ...request,
      offset: source.offset as number,
      length: source.length as number,
    };
  }

  private findEntry(request: AccountExportSnapshotRequest): Entry {
    const entry = this.entries.get(request.handleId);
    if (!entry || !this.matches(entry, request)) {
      throw new ProfileAccountExportSnapshotError('OWNER_SNAPSHOT_NOT_FOUND');
    }
    this.assertLive(entry);
    return entry;
  }

  private matches(
    entry: Entry,
    grant: AccountExportCaptureGrant & { handleId: string }
  ): boolean {
    return (
      entry.handleId === grant.handleId &&
      entry.grantScope.accountId === grant.accountId &&
      entry.grantScope.appId === grant.appId &&
      entry.grantScope.jobId === grant.jobId &&
      entry.grantScope.attempt === grant.attempt &&
      entry.grantScope.leaseOwner === grant.leaseOwner
    );
  }

  private assertLive(entry: Entry): void {
    if (this.closing) {
      throw new ProfileAccountExportSnapshotError('OWNER_SNAPSHOT_CLOSED');
    }
    if (entry.retired) {
      throw new ProfileAccountExportSnapshotError(
        'OWNER_SNAPSHOT_CLEANUP_FAILED'
      );
    }
    if (entry.expiresAtMs <= Date.now() || !this.entries.has(entry.handleId)) {
      void this.expire(entry.handleId).catch(() => undefined);
      throw new ProfileAccountExportSnapshotError('OWNER_SNAPSHOT_EXPIRED');
    }
  }

  private descriptor(entry: Entry): AccountExportSnapshotDescriptor {
    const metadata = entry.spool.metadata;
    return {
      handleId: entry.handleId,
      participantId: metadata.participantId,
      accountId: metadata.accountId,
      captureId: metadata.captureId,
      snapshotAt: metadata.snapshotAt,
      sizeBytes: metadata.sizeBytes,
      sha256: metadata.sha256,
      rowCount: metadata.rowCount,
      sources: [...PROFILE_ACCOUNT_EXPORT_SOURCES],
      sourceRowCounts: { ...metadata.sourceRowCounts },
      sourceDispositions: { ...metadata.sourceDispositions },
      identityCount: entry.identityCount,
      expiresAt: new Date(entry.expiresAtMs).toISOString(),
    };
  }

  private async readIdentityChunk(
    entry: Entry,
    page: IdentityIndexPage
  ): Promise<Array<{ data?: Record<string, unknown> }>> {
    const contentLength = page.byteLength - 1;
    if (
      contentLength < 1 ||
      contentLength > ACCOUNT_EXPORT_SNAPSHOT_LIMITS.lineBytes
    ) {
      throw new ProfileAccountExportSnapshotError('OWNER_READ_FAILED');
    }
    const buffer = Buffer.alloc(contentLength);
    let copied = 0;
    while (copied < buffer.length) {
      const length = Math.min(
        ACCOUNT_EXPORT_SNAPSHOT_LIMITS.readBytes,
        buffer.length - copied
      );
      const bytes = await entry.spool.readChunk(page.offset + copied, length);
      bytes.copy(buffer, copied);
      copied += bytes.length;
    }
    const terminator = await entry.spool.readChunk(
      page.offset + contentLength,
      1
    );
    if (terminator[0] !== 0x0a) {
      throw new ProfileAccountExportSnapshotError('OWNER_READ_FAILED');
    }
    let chunk: Record<string, any>;
    try {
      chunk = JSON.parse(buffer.toString('utf8'));
    } catch {
      throw new ProfileAccountExportSnapshotError('OWNER_READ_FAILED');
    }
    if (
      chunk.source !== 'profileIdentity' ||
      chunk.accountId !== entry.spool.metadata.accountId ||
      chunk.captureId !== entry.spool.metadata.captureId ||
      !Array.isArray(chunk.records) ||
      chunk.records.length !== page.count
    ) {
      throw new ProfileAccountExportSnapshotError('OWNER_READ_FAILED');
    }
    return chunk.records;
  }

  private async expire(handleId: string): Promise<void> {
    const entry = this.entries.get(handleId);
    if (entry) await this.remove(entry);
  }

  private async remove(entry: Entry): Promise<void> {
    if (this.entries.get(entry.handleId) !== entry) return;
    entry.retired = true;
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = undefined;
    if (entry.cleanupPromise) return entry.cleanupPromise;
    entry.cleanupPromise = (async () => {
      let cleanupSucceeded = false;
      for (let attempt = 0; attempt < 2 && !cleanupSucceeded; attempt++) {
        try {
          await entry.spool.cleanup();
          cleanupSucceeded = true;
        } catch {
          // Keep the retired entry charged and inaccessible until cleanup succeeds.
        }
      }
      if (!cleanupSucceeded) {
        throw new ProfileAccountExportSnapshotError(
          'OWNER_SNAPSHOT_CLEANUP_FAILED'
        );
      }
      if (this.entries.get(entry.handleId) === entry) {
        this.entries.delete(entry.handleId);
        this.reservedBytes = Math.max(
          0,
          this.reservedBytes - entry.reservedBytes
        );
      }
    })();
    try {
      await entry.cleanupPromise;
    } finally {
      entry.cleanupPromise = undefined;
    }
  }

  private retiredEntry(
    grant: AccountExportCaptureGrant,
    spool: OwnerSpoolHandle<ProfileAccountExportSource>,
    reservedBytes: number
  ): Entry {
    return {
      handleId: randomUUID(),
      grantScope: {
        accountId: grant.accountId,
        appId: grant.appId,
        jobId: grant.jobId,
        attempt: grant.attempt,
        leaseOwner: grant.leaseOwner,
      },
      spool,
      identityPages: [],
      identityCount: 0,
      expiresAtMs: 0,
      reservedBytes,
      retired: true,
    };
  }

  private closeOpening(controller: AbortController): void {
    this.opening.delete(controller);
    if (this.opening.size === 0) {
      this.openingDrained?.();
      this.openingDrained = undefined;
    }
  }
}
