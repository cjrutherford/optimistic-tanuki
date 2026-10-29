import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { AuthCommands } from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportOwnerChunk,
  AccountExportSnapshotDescriptor,
  AccountExportSnapshotReadRequest,
  AccountExportSnapshotReadResult,
  AccountExportSnapshotRequest,
  ACCOUNT_EXPORT_SNAPSHOT_LIMITS,
  ProfileBoundAccountExportSnapshotDescriptor,
  isAccountExportCaptureGrant,
} from '@optimistic-tanuki/models';
import {
  AccountExportOwnerSpoolService,
  OwnerSpoolHandle,
} from './account-export-owner-spool.service';
import { firstValueFrom, timeout } from 'rxjs';
import { createHash, randomUUID } from 'node:crypto';

const AUTH_TIMEOUT_MS = 3000;
const CAPTURE_TIMEOUT_MS = 45_000;
const PURGE_DRAIN_TIMEOUT_MS = CAPTURE_TIMEOUT_MS + AUTH_TIMEOUT_MS * 2 + 5000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Scope = Pick<
  AccountExportCaptureGrant,
  'accountId' | 'appId' | 'jobId' | 'attempt' | 'leaseOwner'
>;
type ParentDescriptor = AccountExportSnapshotDescriptor;
type Entry<TSource extends string> = {
  handleId: string;
  scope: Scope;
  profile: Pick<
    ProfileBoundAccountExportSnapshotDescriptor,
    'profileHandleId' | 'profileCaptureId' | 'profileSnapshotAt'
  >;
  spool: OwnerSpoolHandle<TSource>;
  expiresAtMs: number;
  reservedBytes: number;
  retired: boolean;
  timer?: NodeJS.Timeout;
  cleanupPromise?: Promise<void>;
  readChain: Promise<void>;
};

export interface ProfileBoundSnapshotOwner<TSource extends string> {
  captureAccount(value: {
    grant: AccountExportCaptureGrant;
    profileSnapshot: AccountExportSnapshotDescriptor;
    onChunk: (chunk: AccountExportOwnerChunk<TSource>) => Promise<void>;
    signal?: AbortSignal;
    captureTimeoutMs?: number;
  }): Promise<AccountExportOwnerChunk<TSource>>;
}

export interface ProfileBoundSnapshotConfig<TSource extends string> {
  participantId: string;
  sources: readonly TSource[];
}

export class AccountExportProfileBoundSnapshotError extends RpcException {
  constructor(readonly code: string) {
    super({ code });
    this.name = 'AccountExportProfileBoundSnapshotError';
  }
}

@Injectable()
export class AccountExportProfileBoundSnapshotService<TSource extends string>
  implements OnModuleDestroy
{
  private readonly entries = new Map<string, Entry<TSource>>();
  private readonly opening = new Map<AbortController, string>();
  private readonly purgedAccounts = new Set<string>();
  private readonly accountOpenDrains = new Map<string, Set<() => void>>();
  private readonly accountReadDrains = new Map<string, Set<Promise<void>>>();
  private reservedBytes = 0;
  private closing = false;
  private openDrain?: () => void;
  private readonly participantId: string;
  private readonly sources: readonly TSource[];

  constructor(
    private readonly owner: ProfileBoundSnapshotOwner<TSource>,
    private readonly spoolService: AccountExportOwnerSpoolService,
    private readonly authClient: ClientProxy,
    config: ProfileBoundSnapshotConfig<TSource>
  ) {
    if (
      !config.participantId ||
      !config.sources.length ||
      new Set(config.sources).size !== config.sources.length
    )
      throw new Error('OWNER_SNAPSHOT_INVALID_CONFIGURATION');
    this.participantId = config.participantId;
    this.sources = [...config.sources];
  }

  async open(
    value: unknown
  ): Promise<ProfileBoundAccountExportSnapshotDescriptor> {
    if (this.closing) this.fail('OWNER_SNAPSHOT_CLOSED');
    const { grant, profile, binding } = this.openRequest(value);
    const accountKey = this.accountKey(grant.accountId);
    if (this.purgedAccounts.has(accountKey)) this.fail('OWNER_ACCOUNT_PURGED');
    await this.assertLease(grant);
    if (this.closing) this.fail('OWNER_SNAPSHOT_CLOSED');
    if (this.purgedAccounts.has(accountKey)) this.fail('OWNER_ACCOUNT_PURGED');
    if (
      this.entries.size + this.opening.size >=
        ACCOUNT_EXPORT_SNAPSHOT_LIMITS.entries ||
      this.reservedBytes + ACCOUNT_EXPORT_SNAPSHOT_LIMITS.captureBytes >
        ACCOUNT_EXPORT_SNAPSHOT_LIMITS.aggregateBytes
    ) {
      this.fail('OWNER_SNAPSHOT_CAPACITY');
    }
    this.reservedBytes += ACCOUNT_EXPORT_SNAPSHOT_LIMITS.captureBytes;
    const controller = new AbortController();
    this.opening.set(controller, accountKey);
    let spool: OwnerSpoolHandle<TSource> | undefined;
    let ownerPromise: Promise<unknown> | undefined;
    try {
      const capture = this.spoolService.capture<TSource>(
        {
          participantId: this.participantId,
          accountId: grant.accountId,
          sources: this.sources,
          maxBytes: ACCOUNT_EXPORT_SNAPSHOT_LIMITS.captureBytes,
          timeoutMs: CAPTURE_TIMEOUT_MS,
          signal: controller.signal,
        },
        async (onChunk, signal) => {
          ownerPromise = Promise.resolve().then(() =>
            this.owner.captureAccount({
              grant,
              profileSnapshot: profile,
              signal,
              captureTimeoutMs: CAPTURE_TIMEOUT_MS,
              onChunk: async (chunk) => {
                if (this.closing || controller.signal.aborted)
                  throw new Error('capture closed');
                await onChunk(chunk);
              },
            })
          );
          return ownerPromise as Promise<AccountExportOwnerChunk<TSource>>;
        }
      );
      spool = await capture;
      if (this.purgedAccounts.has(accountKey)) controller.abort();
      if (this.closing || controller.signal.aborted)
        this.fail(
          this.purgedAccounts.has(accountKey)
            ? 'OWNER_ACCOUNT_PURGED'
            : 'OWNER_SNAPSHOT_CLOSED'
        );
      await this.assertLease(grant);
      if (this.closing || controller.signal.aborted)
        this.fail(
          this.purgedAccounts.has(accountKey)
            ? 'OWNER_ACCOUNT_PURGED'
            : 'OWNER_SNAPSHOT_CLOSED'
        );
      const handleId = randomUUID();
      const expiresAtMs = Date.now() + ACCOUNT_EXPORT_SNAPSHOT_LIMITS.ttlMs;
      const entry: Entry<TSource> = {
        handleId,
        scope: {
          accountId: grant.accountId,
          appId: grant.appId,
          jobId: grant.jobId,
          attempt: grant.attempt,
          leaseOwner: grant.leaseOwner,
        },
        profile: binding,
        spool,
        expiresAtMs,
        reservedBytes: spool.metadata.sizeBytes,
        retired: false,
        readChain: Promise.resolve(),
        timer: setTimeout(
          () => void this.expire(handleId).catch(() => undefined),
          ACCOUNT_EXPORT_SNAPSHOT_LIMITS.ttlMs
        ),
      };
      entry.timer?.unref?.();
      const descriptor = this.descriptor(entry);
      this.reservedBytes -=
        ACCOUNT_EXPORT_SNAPSHOT_LIMITS.captureBytes - entry.reservedBytes;
      this.entries.set(handleId, entry);
      spool = undefined;
      return descriptor;
    } catch (error) {
      // The generic spool can reject on abort before its producer settles. Keep the
      // reservation and opening slot until the database owner has completed cleanup.
      if (ownerPromise) await ownerPromise.catch(() => undefined);
      let cleanupFailed = false;
      if (spool) {
        try {
          await spool.cleanup();
          this.reservedBytes -= ACCOUNT_EXPORT_SNAPSHOT_LIMITS.captureBytes;
        } catch {
          cleanupFailed = true;
          this.retireUnpublished(grant, spool);
        }
      } else if (!cleanupFailed) {
        this.reservedBytes -= ACCOUNT_EXPORT_SNAPSHOT_LIMITS.captureBytes;
      }
      if (cleanupFailed) this.fail('OWNER_SNAPSHOT_CLEANUP_FAILED');
      if (error instanceof AccountExportProfileBoundSnapshotError) throw error;
      return this.fail(
        this.closing ? 'OWNER_SNAPSHOT_CLOSED' : 'OWNER_CAPTURE_FAILED'
      );
    } finally {
      this.opening.delete(controller);
      if (!this.opening.size) {
        this.openDrain?.();
        this.openDrain = undefined;
      }
      const accountKey = this.accountKey(grant.accountId);
      if (![...this.opening.values()].includes(accountKey)) {
        for (const resolve of this.accountOpenDrains.get(accountKey) ?? [])
          resolve();
        this.accountOpenDrains.delete(accountKey);
      }
    }
  }

  async read(value: unknown): Promise<AccountExportSnapshotReadResult> {
    const request = this.readRequest(value);
    const entry = this.find(request);
    await this.assertLease(request);
    this.assertLive(entry);
    if (
      !Number.isSafeInteger(request.offset) ||
      request.offset < 0 ||
      request.offset > entry.spool.metadata.sizeBytes ||
      !Number.isSafeInteger(request.length) ||
      request.length < 0 ||
      request.length > ACCOUNT_EXPORT_SNAPSHOT_LIMITS.readBytes ||
      (request.length === 0 &&
        request.offset !== entry.spool.metadata.sizeBytes)
    )
      this.fail('OWNER_SNAPSHOT_INVALID_RANGE');
    const length = Math.min(
      request.length,
      entry.spool.metadata.sizeBytes - request.offset
    );
    let release!: () => void;
    const previous = entry.readChain;
    entry.readChain = new Promise<void>((resolve) => (release = resolve));
    const readKey = this.accountKey(entry.scope.accountId);
    const accountReads =
      this.accountReadDrains.get(readKey) ?? new Set<Promise<void>>();
    let finishRead!: () => void;
    const readDone = new Promise<void>((resolve) => (finishRead = resolve));
    accountReads.add(readDone);
    this.accountReadDrains.set(readKey, accountReads);
    await previous;
    try {
      this.assertLive(entry);
      const bytes = length
        ? await entry.spool.readChunk(request.offset, length)
        : Buffer.alloc(0);
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
    } finally {
      release();
      finishRead();
      accountReads.delete(readDone);
      if (!accountReads.size) this.accountReadDrains.delete(readKey);
    }
  }

  async release(value: unknown): Promise<{ handleId: string; released: true }> {
    const request = this.request(value);
    const entry = this.entries.get(request.handleId);
    if (entry && !this.matches(entry, request))
      this.fail('OWNER_SNAPSHOT_NOT_FOUND');
    if (entry) await this.remove(entry);
    return { handleId: request.handleId, released: true };
  }

  /** Trusted-internal, irreversible process-local purge fence. */
  async purgeAccount(accountId: string): Promise<{ remaining: 0 }> {
    if (
      typeof accountId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        accountId
      )
    )
      this.fail('OWNER_AUTHORIZATION_FAILED');
    const accountKey = this.accountKey(accountId);
    if (
      this.purgedAccounts.size >= 10000 &&
      !this.purgedAccounts.has(accountKey)
    )
      this.fail('OWNER_SNAPSHOT_CAPACITY');
    this.purgedAccounts.add(accountKey);
    for (const [controller, ownerKey] of this.opening)
      if (ownerKey === accountKey) controller.abort();

    const drain = async (): Promise<void> => {
      while (true) {
        const opens = [...this.opening.entries()]
          .filter(([, key]) => key === accountKey)
          .map(([controller]) => controller);
        const entries = [...this.entries.values()].filter(
          (entry) => this.accountKey(entry.scope.accountId) === accountKey
        );
        if (!opens.length && !entries.length) return;
        const openDrain = opens.length
          ? this.waitForAccountOpen(accountKey)
          : undefined;
        const readDrain = entries.length
          ? this.waitForAccountReads(accountKey)
          : undefined;
        await Promise.all([
          ...(openDrain ? [openDrain] : []),
          ...(readDrain ? [readDrain] : []),
          ...entries.map((entry) => this.remove(entry)),
        ]);
      }
    };
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        drain(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new AccountExportProfileBoundSnapshotError(
                  'OWNER_SNAPSHOT_DRAIN_TIMEOUT'
                )
              ),
            PURGE_DRAIN_TIMEOUT_MS
          );
          timer.unref?.();
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
    return { remaining: 0 };
  }

  private accountKey(accountId: string): string {
    return createHash('sha256').update(accountId.toLowerCase()).digest('hex');
  }

  private waitForAccountOpen(accountKey: string): Promise<void> {
    if (![...this.opening.values()].includes(accountKey))
      return Promise.resolve();
    return new Promise<void>((resolve) => {
      const drains = this.accountOpenDrains.get(accountKey) ?? new Set();
      drains.add(resolve);
      this.accountOpenDrains.set(accountKey, drains);
    });
  }

  private waitForAccountReads(accountKey: string): Promise<void> {
    const reads = this.accountReadDrains.get(accountKey);
    return reads?.size
      ? Promise.all([...reads]).then(() => undefined)
      : Promise.resolve();
  }

  async onModuleDestroy(): Promise<void> {
    this.closing = true;
    for (const controller of this.opening.keys()) controller.abort();
    if (this.opening.size)
      await new Promise<void>((resolve) => {
        this.openDrain = resolve;
      });
    await Promise.allSettled(
      [...this.entries.values()].map((entry) => this.remove(entry))
    );
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
      )
        throw new Error();
    } catch {
      this.fail('OWNER_AUTHORIZATION_FAILED');
    }
  }

  private openRequest(value: unknown): {
    grant: AccountExportCaptureGrant;
    profile: ParentDescriptor;
    binding: Entry<TSource>['profile'];
  } {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      this.fail('OWNER_AUTHORIZATION_FAILED');
    const source = value as Record<string, unknown>;
    const grant = this.grant(source);
    const p = source['profileSnapshot'] as Record<string, unknown> | undefined;
    if (
      !p ||
      Array.isArray(p) ||
      p['participantId'] !== 'profile' ||
      p['accountId'] !== grant['accountId'] ||
      typeof p['handleId'] !== 'string' ||
      !UUID.test(p['handleId']) ||
      typeof p['captureId'] !== 'string' ||
      !UUID.test(p['captureId']) ||
      typeof p['snapshotAt'] !== 'string' ||
      !Number.isFinite(Date.parse(p['snapshotAt'])) ||
      p['snapshotAt'].length > 128 ||
      !Number.isSafeInteger(p['identityCount']) ||
      (p['identityCount'] as number) < 0 ||
      (p['identityCount'] as number) >
        ACCOUNT_EXPORT_SNAPSHOT_LIMITS.identityPages *
          ACCOUNT_EXPORT_SNAPSHOT_LIMITS.identityPageSize ||
      !Array.isArray(p['sources']) ||
      !p['sources'].length ||
      p['sources'].length > 32 ||
      new Set(p['sources']).size !== p['sources'].length ||
      p['sources'].some(
        (s) =>
          typeof s !== 'string' || !/^[A-Za-z][A-Za-z0-9._:-]{0,79}$/.test(s)
      ) ||
      !this.rowCounts(p['sourceRowCounts'], p['sources'] as string[]) ||
      !this.dispositions(p['sourceDispositions'], p['sources'] as string[]) ||
      !Number.isSafeInteger(p['sizeBytes']) ||
      (p['sizeBytes'] as number) < 0 ||
      (p['sizeBytes'] as number) >
        ACCOUNT_EXPORT_SNAPSHOT_LIMITS.captureBytes ||
      !Number.isSafeInteger(p['rowCount']) ||
      (p['rowCount'] as number) < 0 ||
      typeof p['sha256'] !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(p['sha256']) ||
      typeof p['expiresAt'] !== 'string' ||
      !Number.isFinite(Date.parse(p['expiresAt']))
    )
      this.fail('OWNER_AUTHORIZATION_FAILED');
    const profile: ParentDescriptor = {
      handleId: p['handleId'] as string,
      participantId: 'profile',
      accountId: p['accountId'] as string,
      captureId: p['captureId'] as string,
      snapshotAt: p['snapshotAt'] as string,
      sizeBytes: p['sizeBytes'] as number,
      sha256: p['sha256'] as string,
      rowCount: p['rowCount'] as number,
      sources: [...p['sources']] as string[],
      sourceRowCounts: { ...(p['sourceRowCounts'] as Record<string, number>) },
      sourceDispositions: {
        ...(p['sourceDispositions'] as Record<string, string>),
      },
      identityCount: p['identityCount'] as number,
      expiresAt: p['expiresAt'] as string,
    };
    return {
      grant,
      profile,
      binding: {
        profileHandleId: profile.handleId,
        profileCaptureId: profile.captureId,
        profileSnapshotAt: profile.snapshotAt,
      },
    };
  }

  private rowCounts(value: unknown, sources: string[]): boolean {
    return (
      !!value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length <= sources.length &&
      Object.entries(value).every(
        ([k, v]) =>
          sources.includes(k) && Number.isSafeInteger(v) && (v as number) >= 0
      )
    );
  }

  private dispositions(value: unknown, sources: string[]): boolean {
    return (
      !!value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length <= sources.length &&
      Object.entries(value).every(
        ([k, v]) =>
          sources.includes(k) &&
          typeof v === 'string' &&
          v.length > 0 &&
          v.length <= 80
      )
    );
  }

  private grant(value: unknown): AccountExportCaptureGrant {
    if (!isAccountExportCaptureGrant(value))
      this.fail('OWNER_AUTHORIZATION_FAILED');
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
    if (!value || typeof value !== 'object' || Array.isArray(value))
      this.fail('OWNER_AUTHORIZATION_FAILED');
    const source = value as Record<string, unknown>;
    const grant = this.grant(source);
    if (
      typeof source['handleId'] !== 'string' ||
      !UUID.test(source['handleId'])
    )
      this.fail('OWNER_SNAPSHOT_NOT_FOUND');
    return { ...grant, handleId: source['handleId'] };
  }

  private readRequest(value: unknown): AccountExportSnapshotReadRequest {
    const request = this.request(value);
    const source = value as Record<string, unknown>;
    return {
      ...request,
      offset: source['offset'] as number,
      length: source['length'] as number,
    };
  }

  private find(request: AccountExportSnapshotRequest): Entry<TSource> {
    const entry = this.entries.get(request.handleId);
    if (!entry || !this.matches(entry, request))
      this.fail('OWNER_SNAPSHOT_NOT_FOUND');
    this.assertLive(entry);
    return entry;
  }

  private matches(
    entry: Entry<TSource>,
    grant: AccountExportCaptureGrant & { handleId: string }
  ): boolean {
    return (
      entry.handleId === grant.handleId &&
      entry.scope.accountId === grant.accountId &&
      entry.scope.appId === grant.appId &&
      entry.scope.jobId === grant.jobId &&
      entry.scope.attempt === grant.attempt &&
      entry.scope.leaseOwner === grant.leaseOwner
    );
  }

  private descriptor(
    entry: Entry<TSource>
  ): ProfileBoundAccountExportSnapshotDescriptor {
    const m = entry.spool.metadata;
    const sourceRowCounts: Record<string, number> = {};
    const sourceDispositions: Record<string, string> = {};
    for (const source of this.sources) {
      const count = m.sourceRowCounts[source];
      const disposition = m.sourceDispositions[source];
      if (
        typeof count !== 'number' ||
        !Number.isSafeInteger(count) ||
        count < 0 ||
        typeof disposition !== 'string' ||
        !disposition.length ||
        disposition.length > 4096
      )
        return this.fail('OWNER_CAPTURE_FAILED');
      sourceRowCounts[source] = count;
      sourceDispositions[source] = disposition;
    }
    return {
      handleId: entry.handleId,
      participantId: m.participantId,
      accountId: m.accountId,
      captureId: m.captureId,
      snapshotAt: m.snapshotAt,
      sizeBytes: m.sizeBytes,
      sha256: m.sha256,
      rowCount: m.rowCount,
      sources: [...this.sources],
      sourceRowCounts,
      sourceDispositions,
      identityCount: 0,
      expiresAt: new Date(entry.expiresAtMs).toISOString(),
      ...entry.profile,
    };
  }

  private assertLive(entry: Entry<TSource>): void {
    if (this.closing) this.fail('OWNER_SNAPSHOT_CLOSED');
    if (entry.retired) this.fail('OWNER_SNAPSHOT_CLEANUP_FAILED');
    if (entry.expiresAtMs <= Date.now() || !this.entries.has(entry.handleId)) {
      void this.expire(entry.handleId).catch(() => undefined);
      this.fail('OWNER_SNAPSHOT_EXPIRED');
    }
  }

  private async expire(id: string): Promise<void> {
    const entry = this.entries.get(id);
    if (entry) await this.remove(entry);
  }

  private async remove(entry: Entry<TSource>): Promise<void> {
    if (this.entries.get(entry.handleId) !== entry) return;
    entry.retired = true;
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = undefined;
    if (!entry.cleanupPromise)
      entry.cleanupPromise = (async () => {
        await entry.readChain;
        let ok = false;
        for (let i = 0; i < 2 && !ok; i++) {
          try {
            await entry.spool.cleanup();
            ok = true;
          } catch {
            /* retain charge */
          }
        }
        if (!ok) this.fail('OWNER_SNAPSHOT_CLEANUP_FAILED');
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

  private retireUnpublished(
    grant: AccountExportCaptureGrant,
    spool: OwnerSpoolHandle<TSource>
  ): void {
    const handleId = randomUUID();
    const entry: Entry<TSource> = {
      handleId,
      scope: {
        accountId: grant.accountId,
        appId: grant.appId,
        jobId: grant.jobId,
        attempt: grant.attempt,
        leaseOwner: grant.leaseOwner,
      },
      profile: {
        profileHandleId: '',
        profileCaptureId: '',
        profileSnapshotAt: '',
      },
      spool,
      expiresAtMs: 0,
      reservedBytes: ACCOUNT_EXPORT_SNAPSHOT_LIMITS.captureBytes,
      retired: true,
      readChain: Promise.resolve(),
    };
    this.entries.set(handleId, entry);
    entry.timer = setTimeout(
      () => void this.remove(entry).catch(() => undefined),
      1000
    );
    entry.timer.unref?.();
  }

  private fail(code: string): never {
    throw new AccountExportProfileBoundSnapshotError(code);
  }
}
