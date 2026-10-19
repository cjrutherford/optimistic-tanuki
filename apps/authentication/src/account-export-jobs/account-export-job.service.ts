import { Inject, Injectable } from '@nestjs/common';
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
} from '@optimistic-tanuki/models';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import validator from 'validator';
import { AppService } from '../app/app.service';
import { AccountExportService } from '../app/account-export.service';
import { AccountExportJobEntity } from './entities/account-export-job.entity';

const LEASE_MS = 60_000;

@Injectable()
export class AccountExportJobService {
  constructor(
    @Inject(getRepositoryToken(AccountExportJobEntity))
    private readonly jobs: Repository<AccountExportJobEntity>,
    @Inject('AUTHENTICATION_CONNECTION')
    private readonly dataSource: DataSource,
    private readonly auth: AppService,
    private readonly preview: AccountExportService
  ) {}

  async create(request: unknown): Promise<AccountExportJobStatus> {
    const input = this.validate(request);
    await this.authorize(input.accountId, input.token, input.appId);
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
        coverageVersion: ACCOUNT_EXPORT_COVERAGE_INVENTORY.version,
        coverageSummary: {
          blockers: ['not-started'],
          participantCount: 0,
          artifactAvailable: false,
        },
      });
      return { row: await repo.save(job), created: true };
    });
    if (!result.created) return this.status(result.row);
    return this.run(input, result.row);
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
    return this.run(input, row);
  }

  private async run(
    input: ReturnType<AccountExportJobService['validate']>,
    row: AccountExportJobEntity
  ): Promise<AccountExportJobStatus> {
    const claimed = await this.claim(row.id);
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
    let previewFailureCode: 'preview-unavailable' | 'preview-invalid' =
      'preview-unavailable';
    try {
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
    const updated = await this.finish(claimed, state, summary, errorCode);
    return this.status(updated);
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
    await this.jobs
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
    return {
      contractVersion: ACCOUNT_EXPORT_JOB_CONTRACT_VERSION,
      jobId: row.id,
      accountId: row.accountId,
      appId: row.appId,
      kind: 'export',
      state: row.state,
      attempt: row.attempt,
      coverageVersion: row.coverageVersion,
      coverageSummary: row.coverageSummary,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      artifactUrl: null,
    };
  }
}
