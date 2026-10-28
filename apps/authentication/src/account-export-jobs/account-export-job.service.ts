import { VideosAccountExportSnapshotClient } from './videos-account-export-snapshot.client';
import { AssetsAccountExportSnapshotClient } from './assets-account-export-snapshot.client';
import {
  Inject,
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ACCOUNT_EXPORT_COVERAGE_INVENTORY,
  ACCOUNT_EXPORT_JOB_CONTRACT_VERSION,
  AccountExportJobRequest,
  AccountExportJobResumeRequest,
  AccountExportJobStatus,
  AccountExportJobState,
  evaluateAccountExportCompleteness,
  evaluateAccountExportReleaseCoverage,
} from '@optimistic-tanuki/models';
import { DataSource, Repository } from 'typeorm';
import { randomUUID, createHash } from 'node:crypto';
import validator from 'validator';
import { AppService } from '../app/app.service';
import { TokenEntity } from '../tokens/entities/token.entity';
import { AccountExportService } from '../app/account-export.service';
import { AccountExportJobEntity } from './entities/account-export-job.entity';
import {
  AuthenticationAccountExportOwnerService,
  AUTHENTICATION_ACCOUNT_EXPORT_SOURCES,
} from '../account-export-owner/account-export-owner.service';
import {
  AccountExportOwnerSpoolService,
  OwnerSpoolHandle,
  ArtifactDescriptor,
} from '@optimistic-tanuki/storage';
import {
  ProfileAccountExportSnapshotClient,
  ProfileAccountExportCapture,
} from './profile-account-export-snapshot.client';
import { PermissionsAccountExportSnapshotClient } from './permissions-account-export-snapshot.client';
import { SocialAccountExportSnapshotClient } from './social-account-export-snapshot.client';
import { ForumAccountExportSnapshotClient } from './forum-account-export-snapshot.client';
import { WorkspaceAccountExportSnapshotClient } from './workspace-account-export-snapshot.client';
import { AppConfiguratorAccountExportSnapshotClient } from './app-configurator-account-export-snapshot.client';
import { ClassifiedsAccountExportSnapshotClient } from './classifieds-account-export-snapshot.client';
import { PaymentsAccountExportSnapshotClient } from './payments-account-export-snapshot.client';
import { AccountExportArtifactService } from './account-export-artifact.service';
import { ChatAccountExportSnapshotClient } from './chat-account-export-snapshot.client';
import {
  ACCOUNT_EXPORT_RELEASE_COVERAGE_VERSION,
  ACCOUNT_EXPORT_RELEASE_SOURCE_REGISTRY,
} from './account-export-release-registry';

const LEASE_MS = 60_000;

@Injectable()
export class AccountExportJobService implements OnModuleInit, OnModuleDestroy {
  private initialRecoveryTimer?: ReturnType<typeof setTimeout>;
  private recoveryTimer?: ReturnType<typeof setInterval>;
  private recovering = false;
  private closing = false;
  private activeLaunches = 0;
  private readonly background = new Set<Promise<void>>();
  private readonly deletedAccounts = new Set<string>();
  private readonly accountWork = new Map<string, Set<Promise<unknown>>>();
  constructor(
    @Inject(getRepositoryToken(AccountExportJobEntity))
    private readonly jobs: Repository<AccountExportJobEntity>,
    @Inject('AUTHENTICATION_CONNECTION')
    private readonly dataSource: DataSource,
    private readonly auth: AppService,
    private readonly preview: AccountExportService,
    private readonly owner: AuthenticationAccountExportOwnerService,
    private readonly ownerSpool: AccountExportOwnerSpoolService,
    private readonly profileCapture: ProfileAccountExportSnapshotClient,
    private readonly assetsCapture: AssetsAccountExportSnapshotClient,
    private readonly videosCapture: VideosAccountExportSnapshotClient,
    private readonly permissionsCapture: PermissionsAccountExportSnapshotClient,
    private readonly socialCapture: SocialAccountExportSnapshotClient,
    private readonly forumCapture: ForumAccountExportSnapshotClient,
    private readonly workspaceCapture: WorkspaceAccountExportSnapshotClient,
    private readonly appConfiguratorCapture: AppConfiguratorAccountExportSnapshotClient,
    private readonly chatCapture: ChatAccountExportSnapshotClient,
    private readonly classifiedsCapture: ClassifiedsAccountExportSnapshotClient,
    private readonly paymentsCapture: PaymentsAccountExportSnapshotClient,
    private readonly artifacts: AccountExportArtifactService
  ) {}

  async create(request: unknown): Promise<AccountExportJobStatus> {
    const input = this.validate(request);
    await this.authorize(input.accountId, input.token, input.appId);
    const sessionRef = this.releaseScope(input.appId)
      ? await this.sessionReference(input)
      : undefined;
    const result = await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        this.lockKey(input.accountId),
      ]);
      const repo = manager.getRepository(AccountExportJobEntity);
      const existing = await repo.findOne({
        where: {
          accountId: input.accountId,
          appId: input.appId,
          kind: 'export',
          idempotencyKey: input.idempotencyKey,
        },
      });
      if (existing) return { row: existing, created: false };
      const active = await repo
        .createQueryBuilder('job')
        .where(
          'job.accountId = :accountId AND job.kind = :kind AND job.state IN (:...states)',
          {
            accountId: input.accountId,
            kind: 'export',
            states: ['queued', 'running'],
          }
        )
        .getOne();
      if (active)
        this.raise(
          409,
          'EXPORT_JOB_BUSY',
          'An account export operation is already running'
        );
      const job = repo.create({
        accountId: input.accountId,
        appId: input.appId,
        kind: 'export',
        idempotencyKey: input.idempotencyKey,
        state: 'queued',
        coverageVersion:
          input.appId === 'client-interface' || input.appId === 'local-hub'
            ? ACCOUNT_EXPORT_RELEASE_COVERAGE_VERSION
            : ACCOUNT_EXPORT_COVERAGE_INVENTORY.version,
        coverageSummary: {
          ...(sessionRef ? { privateSessionRef: sessionRef } : {}),
          blockers: ['not-started'],
          participantCount: 0,
          artifactAvailable: false,
        },
      });
      return { row: await repo.save(job), created: true };
    });
    if (!result.created) return this.status(result.row);
    return this.releaseScope(input.appId)
      ? this.launch(input, result.row)
      : this.run(input, result.row);
  }

  async latest(request: unknown): Promise<AccountExportJobStatus | null> {
    const input = this.validate(request, false);
    await this.authorize(input.accountId, input.token, input.appId);
    const row = await this.jobs.findOne({
      where: { accountId: input.accountId, appId: input.appId, kind: 'export' },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    await this.authorize(input.accountId, input.token, input.appId);
    return row ? this.status(row) : null;
  }

  async get(request: unknown): Promise<AccountExportJobStatus> {
    const input = this.validate(request, false);
    if (!input.jobId)
      this.raise(
        400,
        'EXPORT_JOB_INVALID_REQUEST',
        'Invalid export operation request'
      );
    await this.authorize(input.accountId, input.token, input.appId);
    const row = await this.jobs.findOne({
      where: {
        id: input.jobId,
        accountId: input.accountId,
        appId: input.appId,
        kind: 'export',
      },
    });
    if (!row)
      this.raise(404, 'EXPORT_JOB_NOT_FOUND', 'Export operation not found');
    return this.status(row);
  }

  async resume(request: unknown): Promise<AccountExportJobStatus> {
    const input = this.validate(request, false);
    if (!input.jobId)
      this.raise(
        400,
        'EXPORT_JOB_INVALID_REQUEST',
        'Invalid export operation request'
      );
    await this.authorize(input.accountId, input.token, input.appId);
    const row = await this.jobs.findOne({
      where: {
        id: input.jobId,
        accountId: input.accountId,
        appId: input.appId,
        kind: 'export',
      },
    });
    if (!row)
      this.raise(404, 'EXPORT_JOB_NOT_FOUND', 'Export operation not found');
    if (row.state === 'complete') return this.status(row);
    return this.releaseScope(input.appId)
      ? this.launch(input, row)
      : this.run(input, row);
  }

  async cancel(request: unknown): Promise<AccountExportJobStatus> {
    const input = this.validate(request, false);
    if (!input.jobId)
      this.raise(
        400,
        'EXPORT_JOB_INVALID_REQUEST',
        'Invalid export operation request'
      );
    if (!['client-interface', 'local-hub'].includes(input.appId))
      this.raise(403, 'EXPORT_JOB_APP_FORBIDDEN', 'App cannot cancel exports');
    await this.authorize(input.accountId, input.token, input.appId);
    const row = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(AccountExportJobEntity);
      const job = await repo
        .createQueryBuilder('job')
        .setLock('pessimistic_write')
        .where(
          'job.id = :id AND job.accountId = :accountId AND job.appId = :appId AND job.kind = :kind',
          {
            id: input.jobId,
            accountId: input.accountId,
            appId: input.appId,
            kind: 'export',
          }
        )
        .getOne();
      if (!job)
        this.raise(404, 'EXPORT_JOB_NOT_FOUND', 'Export operation not found');
      if (job.state === 'complete') return job;
      const summary = job.coverageSummary ?? {};
      const blockers = Array.isArray(summary.blockers)
        ? summary.blockers.filter(
            (value): value is string => typeof value === 'string'
          )
        : [];
      if (!blockers.includes('cancelled')) blockers.push('cancelled');
      return repo.save({
        ...job,
        state: 'failed',
        lastErrorCode: 'EXPORT_JOB_CANCELLED',
        leaseOwner: null,
        leaseExpiresAt: null,
        completedAt: null,
        coverageSummary: {
          ...summary,
          blockers,
          globalCompletionBlocked: true,
          artifactAvailable: false,
        },
      });
    });
    return this.status(row);
  }

  private releaseScope(appId: string): boolean {
    return appId === 'client-interface' || appId === 'local-hub';
  }

  onModuleInit(): void {
    if (this.recoveryTimer) return;
    this.recoveryTimer = setInterval(() => {
      void this.recoverBackground().catch(() => undefined);
    }, 15000);
    this.recoveryTimer.unref();
    this.initialRecoveryTimer = setTimeout(() => {
      void this.recoverBackground().catch(() => undefined);
    }, 1000);
    this.initialRecoveryTimer.unref();
  }
  onModuleDestroy(): void {
    this.closing = true;
    if (this.initialRecoveryTimer) clearTimeout(this.initialRecoveryTimer);
    if (this.recoveryTimer) clearInterval(this.recoveryTimer);
  }

  private async sessionReference(
    input: Pick<AccountExportJobRequest, 'accountId' | 'token' | 'appId'>
  ): Promise<string> {
    const token = await this.dataSource.getRepository(TokenEntity).findOneBy({
      tokenData: input.token,
      userId: input.accountId,
      revoked: false,
    });
    if (!token || !validator.isUUID(token.id))
      this.raise(
        403,
        'EXPORT_JOB_SESSION_INVALID',
        'Account session is invalid for this operation'
      );
    return token.id;
  }

  private async recoverBackground(): Promise<void> {
    if (this.closing || this.recovering) return;
    this.recovering = true;
    try {
      const candidates = await this.jobs
        .createQueryBuilder('job')
        .where(
          `job.kind = :kind AND job.appId IN (:...apps) AND (job.state = :queued OR (job.state = :running AND (job.leaseExpiresAt IS NULL OR job.leaseExpiresAt <= clock_timestamp())) OR (job.state = :failed AND "job"."coverageSummary"->>'artifactState' = :cleanup))`,
          {
            kind: 'export',
            apps: ['client-interface', 'local-hub'],
            queued: 'queued',
            running: 'running',
            failed: 'failed',
            cleanup: 'cleanup-pending',
          }
        )
        .orderBy('job.createdAt', 'ASC')
        .take(25)
        .getMany();
      for (const job of candidates) {
        if (this.closing || this.activeLaunches >= 2) break;
        if (job.state === 'failed') {
          await this.cleanupUnavailableSession(job);
          continue;
        }
        let authorized = false;
        try {
          const ref = job.coverageSummary?.privateSessionRef;
          if (typeof ref !== 'string' || !validator.isUUID(ref))
            throw new Error('Session reference unavailable');
          const token = await this.dataSource
            .getRepository(TokenEntity)
            .findOneBy({ id: ref, userId: job.accountId, revoked: false });
          if (!token) throw new Error('Session unavailable');
          await this.authorize(job.accountId, token.tokenData, job.appId);
          authorized = true;
          await this.launch(
            {
              accountId: job.accountId,
              token: token.tokenData,
              appId: job.appId,
              idempotencyKey: job.idempotencyKey,
            },
            job
          );
        } catch {
          if (!authorized) await this.cleanupUnavailableSession(job);
        }
      }
    } finally {
      this.recovering = false;
    }
  }

  // Removing server-held bytes needs ledger authority, never a still-active user session.
  private async cleanupUnavailableSession(
    row: AccountExportJobEntity
  ): Promise<void> {
    const claim = await this.claim(row.id);
    if (!claim) return;
    let summary: Record<string, unknown> = {
      ...claim.coverageSummary,
      artifactAvailable: false,
    };
    let code = 'export-session-unavailable';
    try {
      await this.artifacts.recover(claim, () => this.renewLease(claim));
      delete summary.privateArtifact;
      delete summary.artifactState;
    } catch {
      summary = { ...summary, artifactState: 'cleanup-pending' };
      code = 'artifact-cleanup-unavailable';
    }
    await this.finish(claim, 'failed', summary, code);
  }

  private accountKey(accountId: string): string {
    return createHash('sha256')
      .update('ot:export-work:' + accountId.toLowerCase())
      .digest('hex');
  }
  private async trackAccount<T>(
    accountId: string,
    task: () => Promise<T>
  ): Promise<T> {
    const key = this.accountKey(accountId);
    if (this.deletedAccounts.has(key))
      this.raise(
        403,
        'EXPORT_ACCOUNT_DELETION_FENCED',
        'Export account is unavailable'
      );
    const work = task();
    const pending = this.accountWork.get(key) ?? new Set<Promise<unknown>>();
    pending.add(work);
    this.accountWork.set(key, pending);
    try {
      return await work;
    } finally {
      pending.delete(work);
      if (!pending.size) this.accountWork.delete(key);
    }
  }
  private launch(
    input: ReturnType<AccountExportJobService['validate']>,
    row: AccountExportJobEntity
  ): Promise<AccountExportJobStatus> {
    return this.trackAccount(input.accountId, () =>
      this.launchCurrent(input, row)
    );
  }
  private run(
    input: ReturnType<AccountExportJobService['validate']>,
    row: AccountExportJobEntity,
    claim?: AccountExportJobEntity
  ): Promise<AccountExportJobStatus> {
    return this.trackAccount(input.accountId, () =>
      this.runCurrent(input, row, claim)
    );
  }
  async purgeAccount(accountId: string): Promise<{ remaining: 0 }> {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        accountId
      )
    )
      throw Error('EXPORT_DELETION_ACCOUNT_INVALID');
    const key = this.accountKey(accountId);
    if (!this.deletedAccounts.has(key) && this.deletedAccounts.size >= 10000)
      throw Error('EXPORT_DELETION_BOUND');
    this.deletedAccounts.add(key);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.allSettled([...(this.accountWork.get(key) ?? [])]),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(Error('EXPORT_DELETION_DRAIN_TIMEOUT')),
            56000
          );
        }),
      ]);
      if ((await this.readbackAccount(accountId)) !== 0)
        throw Error('EXPORT_DELETION_READBACK');
      return { remaining: 0 };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  async readbackAccount(accountId: string): Promise<number> {
    const key = this.accountKey(accountId);
    if (!this.deletedAccounts.has(key))
      throw Error('EXPORT_DELETION_FENCE_REQUIRED');
    return this.accountWork.get(key)?.size ?? 0;
  }

  private async launchCurrent(
    input: ReturnType<AccountExportJobService['validate']>,
    row: AccountExportJobEntity
  ): Promise<AccountExportJobStatus> {
    if (this.closing || this.activeLaunches >= 2)
      this.raise(
        409,
        'EXPORT_JOB_BUSY',
        'Export worker capacity is currently occupied'
      );
    this.activeLaunches++;
    let handedOff = false;
    try {
      const claimed = await this.claim(row.id);
      if (!claimed) {
        const current = await this.jobs.findOneByOrFail({ id: row.id });
        if (current.state === 'running' || current.state === 'complete')
          return this.status(current);
        this.raise(
          409,
          'EXPORT_JOB_BUSY',
          'Another export operation is already active'
        );
      }
      const ref = await this.sessionReference(input);
      const currentSummary = {
        ...claimed.coverageSummary,
        privateSessionRef: ref,
      };
      const referenced = await this.jobs
        .createQueryBuilder()
        .update()
        .set({ coverageSummary: currentSummary })
        .where(
          '"id"=:id AND "state"=:running AND "attempt"=:attempt AND "leaseOwner"=:owner AND "leaseExpiresAt">clock_timestamp()',
          {
            id: claimed.id,
            running: 'running',
            attempt: claimed.attempt,
            owner: claimed.leaseOwner,
          }
        )
        .execute();
      if (referenced.affected !== 1)
        this.raise(
          409,
          'EXPORT_JOB_LEASE_LOST',
          'Export operation lease is no longer current'
        );
      claimed.coverageSummary = currentSummary;
      // The token stays only in this bounded request closure; DB lease state permits explicit recovery after process death.
      const work = Promise.resolve()
        .then(() => this.run(input, claimed, claimed))
        .then(
          () => undefined,
          () => undefined
        )
        .finally(() => {
          this.background.delete(work);
          this.activeLaunches--;
        });
      this.background.add(work);
      handedOff = true;
      return this.status(claimed);
    } finally {
      if (!handedOff) this.activeLaunches--;
    }
  }

  private async runCurrent(
    input: ReturnType<AccountExportJobService['validate']>,
    row: AccountExportJobEntity,
    ownedClaim?: AccountExportJobEntity
  ): Promise<AccountExportJobStatus> {
    const claimed = ownedClaim ?? (await this.claim(row.id));
    if (!claimed) {
      const latest = await this.jobs.findOneByOrFail({ id: row.id });
      if (latest.state === 'running')
        this.raise(
          409,
          'EXPORT_JOB_BUSY',
          'Export operation is already running'
        );
      return this.status(latest);
    }
    let state: AccountExportJobState = 'incomplete';
    let summary: Record<string, unknown>;
    let errorCode: string | null = null;
    let previewFailureCode:
      | 'preview-unavailable'
      | 'preview-invalid'
      | 'artifact-recovery-unavailable' = 'preview-unavailable';
    let ownerHandle: OwnerSpoolHandle<string> | undefined;
    let leaseLost = false;
    let preparedArtifact: ArtifactDescriptor | undefined;
    const renew = async () => {
      const current =
        !this.closing &&
        !this.deletedAccounts.has(this.accountKey(input.accountId)) &&
        (await this.renewLease(claimed));
      if (!current) leaseLost = true;
      return current;
    };
    try {
      if (input.appId === 'client-interface' || input.appId === 'local-hub') {
        previewFailureCode = 'artifact-recovery-unavailable';
        await this.artifacts.recover(claimed, renew);
        previewFailureCode = 'preview-unavailable';
      }
      const result = await this.preview.previewAccountExport(
        input.accountId,
        input.token,
        input.appId
      );
      const participantIds = new Set<string>(
        ACCOUNT_EXPORT_COVERAGE_INVENTORY.participants
      );
      const validParticipants =
        Array.isArray(result?.participants) &&
        result.participants.length <= 100 &&
        result.participants.every(
          (participant) =>
            participant &&
            participant.contractVersion === 1 &&
            participant.accountId === input.accountId &&
            typeof participant.participantId === 'string' &&
            participant.participantId.length <= 80 &&
            participantIds.has(participant.participantId) &&
            ['complete', 'partial', 'failed'].includes(participant.status) &&
            Array.isArray(participant.uncovered) &&
            participant.uncovered.length <= 100 &&
            participant.uncovered.every(
              (marker) => typeof marker === 'string' && marker.length <= 128
            )
        );
      if (
        !result ||
        result.contractVersion !== 1 ||
        result.accountId !== input.accountId ||
        result.status !== 'EXPORT_INCOMPLETE' ||
        result.complete !== false ||
        result.downloadable !== false ||
        result.coverage?.coverageVersion !==
          ACCOUNT_EXPORT_COVERAGE_INVENTORY.version ||
        result.coverage.complete !== false ||
        !Array.isArray(result.coverage.blockers) ||
        result.coverage.blockers.length > 100 ||
        !result.coverage.blockers.every(
          (blocker) => typeof blocker === 'string' && blocker.length <= 128
        ) ||
        !validParticipants
      ) {
        previewFailureCode = 'preview-invalid';
        throw new Error('invalid preview response');
      }
      const completeness = evaluateAccountExportCompleteness(
        result.participants,
        input.accountId
      );
      summary = {
        blockers: [
          ...(!ACCOUNT_EXPORT_COVERAGE_INVENTORY.accepted
            ? ['coverage-inventory-unaccepted']
            : []),
          ...(!completeness.complete
            ? ['required-participants-incomplete']
            : []),
          'portable-media-unverified',
        ],
        participantCount: result.participants.length,
        artifactAvailable: false,
      };
    } catch {
      summary = {
        blockers: [previewFailureCode],
        participantCount: 0,
        artifactAvailable: false,
      };
      errorCode = previewFailureCode;
      state = 'failed';
    }
    if (typeof claimed.coverageSummary?.privateSessionRef === 'string')
      summary = {
        ...summary,
        privateSessionRef: claimed.coverageSummary.privateSessionRef,
      };
    if (state === 'incomplete') {
      try {
        if (!(await this.renewLease(claimed))) {
          leaseLost = true;
          throw new Error('lease lost');
        }
        ownerHandle = await this.ownerSpool.capture(
          {
            participantId: 'authentication',
            accountId: input.accountId,
            sources: AUTHENTICATION_ACCOUNT_EXPORT_SOURCES,
          },
          async (onChunk, signal) =>
            this.owner.captureAccount({
              accountId: input.accountId,
              sessionToken: input.token,
              appId: input.appId,
              signal,
              onChunk: async (chunk, ownerSignal) => {
                if (signal.aborted || ownerSignal?.aborted)
                  throw new Error('capture aborted');
                if (!(await this.renewLease(claimed))) {
                  leaseLost = true;
                  throw new Error('lease lost');
                }
                if (signal.aborted || ownerSignal?.aborted)
                  throw new Error('capture aborted');
                await onChunk(chunk);
              },
            })
        );
        summary = { ...summary, capturedDatabaseOwners: ['authentication'] };
      } catch {
        if (!leaseLost) {
          const blockers = Array.isArray(summary.blockers)
            ? summary.blockers.filter(
                (blocker): blocker is string => typeof blocker === 'string'
              )
            : [];
          summary = {
            ...summary,
            blockers: [...blockers, 'owner-capture-unavailable'],
          };
          errorCode = 'owner-capture-unavailable';
          state = 'failed';
        }
      }
    }
    if (state === 'incomplete' && !leaseLost) {
      let profile: ProfileAccountExportCapture | undefined;
      let assets:
        | Awaited<ReturnType<AssetsAccountExportSnapshotClient['capture']>>
        | undefined;
      let videos:
        | Awaited<ReturnType<VideosAccountExportSnapshotClient['capture']>>
        | undefined;
      let permissions:
        | Awaited<ReturnType<PermissionsAccountExportSnapshotClient['capture']>>
        | undefined;
      let social:
        | Awaited<ReturnType<SocialAccountExportSnapshotClient['capture']>>
        | undefined;
      let forum:
        | Awaited<ReturnType<ForumAccountExportSnapshotClient['capture']>>
        | undefined;
      let workspace:
        | Awaited<ReturnType<WorkspaceAccountExportSnapshotClient['capture']>>
        | undefined;
      let classifieds:
        | Awaited<ReturnType<ClassifiedsAccountExportSnapshotClient['capture']>>
        | undefined;
      let chat:
        | Awaited<ReturnType<ChatAccountExportSnapshotClient['capture']>>
        | undefined;
      let appConfigurator:
        | Awaited<
            ReturnType<AppConfiguratorAccountExportSnapshotClient['capture']>
          >
        | undefined;
      let payments:
        | Awaited<ReturnType<PaymentsAccountExportSnapshotClient['capture']>>
        | undefined;
      let stage:
        | 'profile'
        | 'assets'
        | 'videos'
        | 'permissions'
        | 'social'
        | 'forum'
        | 'workspace'
        | 'app-configurator'
        | 'chat-collector'
        | 'classifieds'
        | 'payments'
        | 'artifact' = 'profile';
      try {
        if (!claimed.leaseOwner) {
          leaseLost = true;
          throw new Error('lease lost');
        }
        profile = await this.profileCapture.capture(
          {
            accountId: input.accountId,
            token: input.token,
            appId: input.appId,
            jobId: claimed.id,
            attempt: claimed.attempt,
            leaseOwner: claimed.leaseOwner,
          },
          async () => {
            const renewed = await this.renewLease(claimed);
            if (!renewed) leaseLost = true;
            return renewed;
          }
        );
        // Exercise the same-snapshot identity surface before recording progress.
        await profile.identities(0, 100);
        summary = {
          ...summary,
          capturedDatabaseOwners: ['authentication', 'profile'],
        };
        stage = 'assets';
        assets = await this.assetsCapture.capture(
          {
            accountId: input.accountId,
            token: input.token,
            appId: input.appId,
            jobId: claimed.id,
            attempt: claimed.attempt,
            leaseOwner: claimed.leaseOwner,
          },
          profile.descriptor,
          async () => {
            const renewed = await this.renewLease(claimed);
            if (!renewed) leaseLost = true;
            return renewed;
          }
        );
        summary = {
          ...summary,
          capturedDatabaseOwners: ['authentication', 'profile', 'assets'],
        };
        stage = 'videos';
        videos = await this.videosCapture.capture(
          {
            accountId: input.accountId,
            token: input.token,
            appId: input.appId,
            jobId: claimed.id,
            attempt: claimed.attempt,
            leaseOwner: claimed.leaseOwner,
          },
          profile.descriptor,
          async () => {
            const renewed = await this.renewLease(claimed);
            if (!renewed) leaseLost = true;
            return renewed;
          }
        );
        summary = {
          ...summary,
          capturedDatabaseOwners: [
            'authentication',
            'profile',
            'assets',
            'videos',
          ],
        };
        stage = 'permissions';
        permissions = await this.permissionsCapture.capture(
          {
            accountId: input.accountId,
            token: input.token,
            appId: input.appId,
            jobId: claimed.id,
            attempt: claimed.attempt,
            leaseOwner: claimed.leaseOwner,
          },
          profile.descriptor,
          async () => {
            const renewed = await this.renewLease(claimed);
            if (!renewed) leaseLost = true;
            return renewed;
          }
        );
        summary = {
          ...summary,
          capturedDatabaseOwners: [
            'authentication',
            'profile',
            'assets',
            'videos',
            'permissions',
          ],
        };
        stage = 'social';
        social = await this.socialCapture.capture(
          {
            accountId: input.accountId,
            token: input.token,
            appId: input.appId,
            jobId: claimed.id,
            attempt: claimed.attempt,
            leaseOwner: claimed.leaseOwner,
          },
          profile.descriptor,
          async () => {
            const renewed = await this.renewLease(claimed);
            if (!renewed) leaseLost = true;
            return renewed;
          }
        );
        summary = {
          ...summary,
          capturedDatabaseOwners: [
            'authentication',
            'profile',
            'assets',
            'videos',
            'permissions',
            'social',
          ],
        };
        stage = 'forum';
        forum = await this.forumCapture.capture(
          {
            accountId: input.accountId,
            token: input.token,
            appId: input.appId,
            jobId: claimed.id,
            attempt: claimed.attempt,
            leaseOwner: claimed.leaseOwner,
          },
          profile.descriptor,
          async () => {
            const renewed = await this.renewLease(claimed);
            if (!renewed) leaseLost = true;
            return renewed;
          }
        );
        summary = {
          ...summary,
          capturedDatabaseOwners: [
            'authentication',
            'profile',
            'assets',
            'videos',
            'permissions',
            'social',
            'forum',
          ],
        };
        stage = 'workspace';
        workspace = await this.workspaceCapture.capture(
          {
            accountId: input.accountId,
            token: input.token,
            appId: input.appId,
            jobId: claimed.id,
            attempt: claimed.attempt,
            leaseOwner: claimed.leaseOwner,
          },
          profile.descriptor,
          async () => {
            const renewed = await this.renewLease(claimed);
            if (!renewed) leaseLost = true;
            return renewed;
          }
        );
        summary = {
          ...summary,
          capturedDatabaseOwners: [
            'authentication',
            'profile',
            'assets',
            'videos',
            'permissions',
            'social',
            'forum',
            'workspace',
          ],
        };
        stage = 'app-configurator';
        appConfigurator = await this.appConfiguratorCapture.capture(
          {
            accountId: input.accountId,
            token: input.token,
            appId: input.appId,
            jobId: claimed.id,
            attempt: claimed.attempt,
            leaseOwner: claimed.leaseOwner,
          },
          profile.descriptor,
          async () => {
            const renewed = await this.renewLease(claimed);
            if (!renewed) leaseLost = true;
            return renewed;
          }
        );
        summary = {
          ...summary,
          capturedDatabaseOwners: [
            'authentication',
            'profile',
            'assets',
            'videos',
            'permissions',
            'social',
            'forum',
            'workspace',
            'app-configurator',
          ],
        };
        stage = 'chat-collector';
        chat = await this.chatCapture.capture(
          {
            accountId: input.accountId,
            token: input.token,
            appId: input.appId,
            jobId: claimed.id,
            attempt: claimed.attempt,
            leaseOwner: claimed.leaseOwner,
          },
          profile.descriptor,
          async () => {
            const renewed = await this.renewLease(claimed);
            if (!renewed) leaseLost = true;
            return renewed;
          }
        );
        summary = {
          ...summary,
          capturedDatabaseOwners: [
            'authentication',
            'profile',
            'assets',
            'videos',
            'permissions',
            'social',
            'forum',
            'workspace',
            'app-configurator',
            'chat-collector',
          ],
        };
        stage = 'classifieds';
        classifieds = await this.classifiedsCapture.capture(
          {
            accountId: input.accountId,
            token: input.token,
            appId: input.appId,
            jobId: claimed.id,
            attempt: claimed.attempt,
            leaseOwner: claimed.leaseOwner,
          },
          profile.descriptor,
          async () => {
            const renewed = await this.renewLease(claimed);
            if (!renewed) leaseLost = true;
            return renewed;
          }
        );
        summary = {
          ...summary,
          capturedDatabaseOwners: [
            'authentication',
            'profile',
            'assets',
            'videos',
            'permissions',
            'social',
            'forum',
            'workspace',
            'app-configurator',
            'chat-collector',
            'classifieds',
          ],
        };
        if (input.appId === 'client-interface' || input.appId === 'local-hub') {
          stage = 'payments';
          payments = await this.paymentsCapture.capture(
            {
              accountId: input.accountId,
              token: input.token,
              appId: input.appId,
              jobId: claimed.id,
              attempt: claimed.attempt,
              leaseOwner: claimed.leaseOwner,
            },
            profile.descriptor,
            async () => {
              const renewed = await this.renewLease(claimed);
              if (!renewed) leaseLost = true;
              return renewed;
            }
          );
          summary = {
            ...summary,
            capturedDatabaseOwners: [
              'authentication',
              'profile',
              'assets',
              'videos',
              'permissions',
              'social',
              'forum',
              'workspace',
              'app-configurator',
              'chat-collector',
              'classifieds',
              'payments',
            ],
          };
          const captureCoverage = evaluateAccountExportReleaseCoverage(
            input.appId,
            input.accountId,
            [
              ownerHandle?.metadata,
              profile?.handle.metadata,
              assets?.handle.metadata,
              videos?.handle.metadata,
              permissions?.handle.metadata,
              social?.handle.metadata,
              forum?.handle.metadata,
              workspace?.handle.metadata,
              appConfigurator?.handle.metadata,
              chat?.handle.metadata,
              classifieds?.handle.metadata,
              payments?.handle.metadata,
            ].filter((metadata): metadata is NonNullable<typeof metadata> =>
              Boolean(metadata)
            ),
            ACCOUNT_EXPORT_RELEASE_SOURCE_REGISTRY
          );
          summary = {
            ...summary,
            captureCoverage: {
              coverageVersion: captureCoverage.coverageVersion,
              complete: captureCoverage.complete,
              blockers: captureCoverage.blockers,
            },
          };
          if (!captureCoverage.complete) {
            summary = {
              ...summary,
              blockers: [
                ...(Array.isArray(summary.blockers) ? summary.blockers : []),
                ...captureCoverage.blockers,
              ],
            };
            state = 'failed';
            errorCode = 'capture-coverage-incomplete';
          } else {
            stage = 'artifact';
            const handles: Array<OwnerSpoolHandle<string> | undefined> = [
              ownerHandle,
              profile?.handle,
              assets?.handle,
              videos?.handle,
              permissions?.handle,
              social?.handle,
              forum?.handle,
              workspace?.handle,
              appConfigurator?.handle,
              chat?.handle,
              classifieds?.handle,
              payments?.handle,
            ];
            const prepared = await this.artifacts.prepare({
              claim: claimed,
              handles: handles.filter(
                (handle): handle is OwnerSpoolHandle<string> => Boolean(handle)
              ),
              summary,
              renewLease: renew,
            });
            preparedArtifact = prepared.descriptor;
            state = 'complete';
            summary = {
              ...prepared.summary,
              participantCount: handles.length,
              blockers: [],
              artifactAvailable: true,
            };
          }
        }
      } catch {
        if (!leaseLost) {
          summary = {
            ...summary,
            blockers: [
              ...(Array.isArray(summary.blockers) ? summary.blockers : []),
              `${stage}-capture-unavailable`,
            ],
          };
          state = 'failed';
          errorCode = `${stage}-capture-unavailable`;
        }
      } finally {
        if (payments) {
          try {
            await payments.cleanup();
          } catch {
            if (!leaseLost) {
              summary = {
                ...summary,
                capturedDatabaseOwners: [
                  'authentication',
                  'profile',
                  'assets',
                  'videos',
                  'permissions',
                  'social',
                  'forum',
                  'workspace',
                  'app-configurator',
                  'chat-collector',
                  'classifieds',
                ],
                blockers: [
                  ...(Array.isArray(summary.blockers) ? summary.blockers : []),
                  'payments-capture-unavailable',
                ],
              };
              state = 'failed';
              errorCode = 'payments-capture-unavailable';
            }
          }
        }
        if (classifieds) {
          try {
            await classifieds.cleanup();
          } catch {
            if (!leaseLost) {
              summary = {
                ...summary,
                capturedDatabaseOwners: [
                  'authentication',
                  'profile',
                  'assets',
                  'videos',
                  'permissions',
                  'social',
                  'forum',
                  'workspace',
                  'app-configurator',
                  'chat-collector',
                ],
                blockers: [
                  ...(Array.isArray(summary.blockers) ? summary.blockers : []),
                  'classifieds-capture-unavailable',
                ],
              };
              state = 'failed';
              errorCode = 'classifieds-capture-unavailable';
            }
          }
        }
        if (chat) {
          try {
            await chat.cleanup();
          } catch {
            if (!leaseLost) {
              summary = {
                ...summary,
                capturedDatabaseOwners: [
                  'authentication',
                  'profile',
                  'assets',
                  'videos',
                  'permissions',
                  'social',
                  'forum',
                  'workspace',
                  'app-configurator',
                ],
                blockers: [
                  ...(Array.isArray(summary.blockers) ? summary.blockers : []),
                  'chat-collector-capture-unavailable',
                ],
              };
              state = 'failed';
              errorCode = 'chat-collector-capture-unavailable';
            }
          }
        }
        if (appConfigurator) {
          try {
            await appConfigurator.cleanup();
          } catch {
            if (!leaseLost) {
              summary = {
                ...summary,
                capturedDatabaseOwners: [
                  'authentication',
                  'profile',
                  'assets',
                  'videos',
                  'permissions',
                  'social',
                  'forum',
                  'workspace',
                ],
                blockers: [
                  ...(Array.isArray(summary.blockers) ? summary.blockers : []),
                  'app-configurator-capture-unavailable',
                ],
              };
              state = 'failed';
              errorCode = 'app-configurator-capture-unavailable';
            }
          }
        }
        if (workspace) {
          try {
            await workspace.cleanup();
          } catch {
            if (!leaseLost) {
              summary = {
                ...summary,
                capturedDatabaseOwners: [
                  'authentication',
                  'profile',
                  'assets',
                  'videos',
                  'permissions',
                  'social',
                  'forum',
                ],
                blockers: [
                  ...(Array.isArray(summary.blockers) ? summary.blockers : []),
                  'workspace-capture-unavailable',
                ],
              };
              state = 'failed';
              errorCode = 'workspace-capture-unavailable';
            }
          }
        }
        if (forum) {
          try {
            await forum.cleanup();
          } catch {
            if (!leaseLost) {
              summary = {
                ...summary,
                capturedDatabaseOwners: [
                  'authentication',
                  'profile',
                  'assets',
                  'videos',
                  'permissions',
                  'social',
                ],
                blockers: [
                  ...(Array.isArray(summary.blockers) ? summary.blockers : []),
                  'forum-capture-unavailable',
                ],
              };
              state = 'failed';
              errorCode = 'forum-capture-unavailable';
            }
          }
        }
        if (social) {
          try {
            await social.cleanup();
          } catch {
            if (!leaseLost) {
              summary = {
                ...summary,
                capturedDatabaseOwners: [
                  'authentication',
                  'profile',
                  'assets',
                  'videos',
                  'permissions',
                ],
                blockers: [
                  ...(Array.isArray(summary.blockers) ? summary.blockers : []),
                  'social-capture-unavailable',
                ],
              };
              state = 'failed';
              errorCode = 'social-capture-unavailable';
            }
          }
        }
        if (permissions) {
          try {
            await permissions.cleanup();
          } catch {
            if (!leaseLost) {
              summary = {
                ...summary,
                capturedDatabaseOwners: [
                  'authentication',
                  'profile',
                  'assets',
                  'videos',
                ],
                blockers: [
                  ...(Array.isArray(summary.blockers) ? summary.blockers : []),
                  'permissions-capture-unavailable',
                ],
              };
              state = 'failed';
              errorCode = 'permissions-capture-unavailable';
            }
          }
        }
        if (videos) {
          try {
            await videos.cleanup();
          } catch {
            if (!leaseLost) {
              summary = {
                ...summary,
                capturedDatabaseOwners: ['authentication', 'profile', 'assets'],
                blockers: [
                  ...(Array.isArray(summary.blockers) ? summary.blockers : []),
                  'videos-capture-unavailable',
                ],
              };
              state = 'failed';
              errorCode = 'videos-capture-unavailable';
            }
          }
        }
        if (assets) {
          try {
            await assets.cleanup();
          } catch {
            if (!leaseLost) {
              summary = {
                ...summary,
                capturedDatabaseOwners: ['authentication', 'profile'],
                blockers: [
                  ...(Array.isArray(summary.blockers) ? summary.blockers : []),
                  'assets-capture-unavailable',
                ],
              };
              state = 'failed';
              errorCode = 'assets-capture-unavailable';
            }
          }
        }
        if (profile) {
          try {
            await profile.cleanup();
          } catch {
            if (!leaseLost) {
              summary = {
                ...summary,
                capturedDatabaseOwners: ['authentication'],
                blockers: [
                  ...(Array.isArray(summary.blockers) ? summary.blockers : []),
                  'profile-capture-unavailable',
                ],
              };
              state = 'failed';
              errorCode = 'profile-capture-unavailable';
            }
          }
        }
        if (ownerHandle) {
          try {
            await ownerHandle.cleanup();
          } catch {
            if (!leaseLost) {
              const blockers = Array.isArray(summary.blockers)
                ? summary.blockers.filter(
                    (blocker): blocker is string => typeof blocker === 'string'
                  )
                : [];
              summary = {
                ...summary,
                blockers: [...blockers, 'owner-capture-unavailable'],
              };
              delete summary.capturedDatabaseOwners;
              errorCode = 'owner-capture-unavailable';
              state = 'failed';
            }
          }
        }
      }
    }
    if (preparedArtifact && (state === 'failed' || leaseLost)) {
      try {
        await this.artifacts.discard(claimed, preparedArtifact);
        delete summary.privateArtifact;
        delete summary.artifactState;
      } catch {
        state = 'failed';
        errorCode = 'artifact-cleanup-unavailable';
        summary = {
          ...summary,
          artifactState: 'cleanup-pending',
          artifactAvailable: false,
          blockers: [
            ...(Array.isArray(summary.blockers) ? summary.blockers : []),
            'artifact-cleanup-unavailable',
          ],
        };
      }
    }
    if (leaseLost) {
      this.raise(
        409,
        'EXPORT_JOB_LEASE_LOST',
        'Export operation lease is no longer current'
      );
    }
    try {
      const updated = await this.finish(claimed, state, summary, errorCode);
      return this.status(updated);
    } catch (error) {
      if (preparedArtifact)
        await this.artifacts.discard(claimed, preparedArtifact);
      throw error;
    }
  }

  private async renewLease(claim: AccountExportJobEntity): Promise<boolean> {
    if (this.closing || !claim.leaseOwner) return false;
    const result = await this.jobs
      .createQueryBuilder()
      .update()
      .set({
        leaseExpiresAt: () =>
          `clock_timestamp() + INTERVAL '${LEASE_MS} milliseconds'`,
      })
      .where(
        'id = :id AND state = :running AND attempt = :attempt AND leaseOwner = :owner AND leaseExpiresAt > clock_timestamp()',
        {
          id: claim.id,
          running: 'running',
          attempt: claim.attempt,
          owner: claim.leaseOwner,
        }
      )
      .execute();
    return result.affected === 1;
  }

  private async claim(id: string): Promise<AccountExportJobEntity | null> {
    return this.dataSource.transaction(async (manager) => {
      const candidate = await manager
        .getRepository(AccountExportJobEntity)
        .findOneBy({ id });
      if (!candidate) return null;
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        this.lockKey(candidate.accountId),
      ]);
      const other = await manager
        .getRepository(AccountExportJobEntity)
        .createQueryBuilder('job')
        .where(
          'job.accountId = :accountId AND job.kind = :kind AND job.id <> :id AND job.state IN (:...states)',
          {
            accountId: candidate.accountId,
            kind: candidate.kind,
            id,
            states: ['queued', 'running'],
          }
        )
        .getOne();
      if (other) return null;
      const owner = randomUUID();
      const result = await manager
        .getRepository(AccountExportJobEntity)
        .createQueryBuilder()
        .update()
        .set({
          state: 'running',
          attempt: () => '"attempt" + 1',
          leaseOwner: owner,
          leaseExpiresAt: () =>
            `clock_timestamp() + INTERVAL '${LEASE_MS} milliseconds'`,
          lastErrorCode: null,
        })
        .where(
          'id = :id AND (state IN (:...reclaimable) OR (state = :running AND (leaseExpiresAt IS NULL OR leaseExpiresAt <= clock_timestamp())))',
          {
            id,
            reclaimable: ['queued', 'incomplete', 'failed'],
            running: 'running',
          }
        )
        .execute();
      return result.affected
        ? manager.getRepository(AccountExportJobEntity).findOneByOrFail({ id })
        : null;
    });
  }

  private async finish(
    claim: AccountExportJobEntity,
    state: AccountExportJobState,
    coverageSummary: Record<string, unknown>,
    error: string | null
  ): Promise<AccountExportJobEntity> {
    coverageSummary = { ...coverageSummary };
    delete coverageSummary.privateSessionRef;
    if (state !== 'complete') coverageSummary.artifactAvailable = false;
    if (state === 'failed' && !coverageSummary.privateArtifact) {
      const latest = await this.jobs.findOneBy({
        id: claim.id,
        accountId: claim.accountId,
        appId: claim.appId,
      });
      if (latest?.coverageSummary?.privateArtifact)
        coverageSummary = {
          ...coverageSummary,
          privateArtifact: latest.coverageSummary.privateArtifact,
          artifactState: 'cleanup-pending',
          artifactAvailable: false,
        };
    }
    const result = await this.jobs
      .createQueryBuilder()
      .update()
      .set({
        state,
        coverageSummary,
        lastErrorCode: error,
        leaseOwner: null,
        leaseExpiresAt: null,
        completedAt: state === 'complete' ? new Date() : null,
      })
      .where(
        'id = :id AND state = :running AND attempt = :attempt AND leaseOwner = :owner AND leaseExpiresAt > clock_timestamp()',
        {
          id: claim.id,
          running: 'running',
          attempt: claim.attempt,
          owner: claim.leaseOwner,
        }
      )
      .execute();
    if (result.affected !== 1)
      this.raise(
        409,
        'EXPORT_JOB_LEASE_LOST',
        'Export operation lease is no longer current'
      );
    return this.jobs.findOneByOrFail({ id: claim.id });
  }

  private async authorize(
    accountId: string,
    token: string,
    appId: string
  ): Promise<void> {
    let result: Awaited<ReturnType<AppService['validateToken']>>;
    try {
      result = await this.auth.validateToken(token, appId);
    } catch {
      this.raise(
        403,
        'EXPORT_JOB_SESSION_INVALID',
        'Account session is invalid for this operation'
      );
    }
    if (
      !result?.isValid ||
      result.data?.userId !== accountId ||
      (result.data?.appId && result.data.appId !== appId)
    ) {
      this.raise(
        403,
        'EXPORT_JOB_SESSION_INVALID',
        'Account session is invalid for this operation'
      );
    }
  }

  private validate(
    request: unknown,
    requireIdempotencyKey = true
  ): AccountExportJobRequest & { jobId?: string } {
    if (!request || typeof request !== 'object')
      this.raise(
        400,
        'EXPORT_JOB_INVALID_REQUEST',
        'Invalid export operation request'
      );
    const value = request as Record<string, unknown>;
    const uuid = (v: unknown): v is string =>
      typeof v === 'string' && validator.isUUID(v);
    if (
      !uuid(value.accountId) ||
      (requireIdempotencyKey && !uuid(value.idempotencyKey)) ||
      (value.jobId !== undefined && !uuid(value.jobId)) ||
      typeof value.token !== 'string' ||
      value.token.length < 1 ||
      value.token.length > 8192 ||
      typeof value.appId !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(value.appId)
    )
      this.raise(
        400,
        'EXPORT_JOB_INVALID_REQUEST',
        'Invalid export operation request'
      );
    return value as unknown as AccountExportJobRequest & { jobId?: string };
  }

  private raise(statusCode: number, code: string, message: string): never {
    throw new RpcException({
      contractVersion: ACCOUNT_EXPORT_JOB_CONTRACT_VERSION,
      statusCode,
      code,
      message,
    });
  }

  private lockKey(accountId: string): string {
    return `${accountId}:export`;
  }
  private status(row: AccountExportJobEntity): AccountExportJobStatus {
    const artifact = row.coverageSummary?.privateArtifact as
      | ArtifactDescriptor
      | undefined;
    const available =
      this.releaseScope(row.appId) &&
      row.state === 'complete' &&
      row.coverageSummary?.artifactAvailable === true &&
      row.coverageSummary?.artifactState === 'verified' &&
      artifact?.jobId === row.id &&
      artifact?.accountId === row.accountId &&
      artifact?.appId === row.appId &&
      artifact?.attempt === row.attempt &&
      Date.parse(artifact?.expiresAt ?? '') > Date.now();
    return {
      contractVersion: ACCOUNT_EXPORT_JOB_CONTRACT_VERSION,
      jobId: row.id,
      accountId: row.accountId,
      appId: row.appId,
      kind: 'export',
      state: row.state,
      attempt: row.attempt,
      coverageVersion: row.coverageVersion,
      coverageSummary: {
        ...Object.fromEntries(
          [
            'blockers',
            'participantCount',
            'capturedDatabaseOwners',
            'captureCoverage',
            'artifactAvailable',
          ]
            .filter((key) =>
              Object.prototype.hasOwnProperty.call(
                row.coverageSummary ?? {},
                key
              )
            )
            .map((key) => [key, row.coverageSummary[key]])
        ),
        artifactAvailable: available,
      },
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      artifactUrl: available
        ? `/api/authentication/account-export/${row.id}/download`
        : null,
    };
  }
}
