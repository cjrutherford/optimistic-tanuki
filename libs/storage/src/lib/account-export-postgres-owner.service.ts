import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AuthCommands } from '@optimistic-tanuki/constants';
import {
  ACCOUNT_EXPORT_SNAPSHOT_LIMITS,
  AccountExportCaptureGrant,
  AccountExportOwnerChunk,
  AccountExportOwnerRecord,
  AccountExportSnapshotDescriptor,
  isAccountExportCaptureGrant,
} from '@optimistic-tanuki/models';
import { firstValueFrom, timeout } from 'rxjs';
import { DataSource, QueryRunner } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { AccountExportOwnerEmitter } from './account-export-owner-emitter';
import { AccountExportProfileSnapshotClient } from './account-export-profile-snapshot.client';

export interface AccountExportPostgresSource {
  source: string;
  sql: string;
  project(
    row: Record<string, unknown>,
    accountId: string
  ): Record<string, unknown>;
}

export interface AccountExportPostgresOwnerServiceOptions {
  participantId: string;
  sources: readonly string[];
  createSources(profileTable: string): AccountExportPostgresSource[];
}

export interface AccountExportPostgresCaptureOptions {
  grant: AccountExportCaptureGrant;
  profileSnapshot: AccountExportSnapshotDescriptor;
  onChunk(
    chunk: AccountExportOwnerChunk<string>,
    signal?: AbortSignal
  ): Promise<void>;
  signal?: AbortSignal;
  captureTimeoutMs?: number;
  sources?: readonly string[];
}

export class AccountExportPostgresOwnerError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'AccountExportPostgresOwnerError';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9]{0,63}$/;
const PARTICIPANT_IDENTIFIER = /^[A-Za-z][A-Za-z0-9-]{0,63}$/;
const PAGE = 200;
const MAX_CAPTURE_ROWS = 100_000;
const MAX_CAPTURE_BYTES = 64 * 1024 * 1024;

@Injectable()
export class AccountExportPostgresOwnerService {
  private busy = false;
  private quarantined = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly identities: AccountExportProfileSnapshotClient,
    private readonly authClient: ClientProxy,
    private readonly options: AccountExportPostgresOwnerServiceOptions
  ) {}

  async captureAccount(
    value: AccountExportPostgresCaptureOptions
  ): Promise<AccountExportOwnerChunk<string>> {
    if (this.busy || this.quarantined)
      throw new AccountExportPostgresOwnerError('OWNER_READ_FAILED');
    if (
      !this.options ||
      !PARTICIPANT_IDENTIFIER.test(this.options.participantId) ||
      !Array.isArray(this.options.sources) ||
      !this.options.sources.length ||
      this.options.sources.some((source) => !IDENTIFIER.test(source)) ||
      new Set(this.options.sources).size !== this.options.sources.length ||
      typeof this.options.createSources !== 'function' ||
      !value ||
      !this.validGrant(value.grant) ||
      !this.validDescriptor(value.profileSnapshot) ||
      value.profileSnapshot.accountId !== value.grant.accountId ||
      typeof value.onChunk !== 'function'
    )
      throw new AccountExportPostgresOwnerError('OWNER_AUTHORIZATION_FAILED');
    const grant = {
      ...value.grant,
      accountId: value.grant.accountId.toLowerCase(),
    };
    const descriptor = this.copyDescriptor(value.profileSnapshot);
    const requested = value.sources ?? this.options.sources;
    if (!this.validRequestedSources(requested))
      throw new AccountExportPostgresOwnerError('OWNER_AUTHORIZATION_FAILED');
    const onChunk = value.onChunk;
    const external = value.signal;
    const timeoutMs = value.captureTimeoutMs ?? 45_000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 45_000)
      throw new AccountExportPostgresOwnerError('OWNER_AUTHORIZATION_FAILED');
    this.busy = true;
    const abort = new AbortController();
    const deadline = Date.now() + timeoutMs;
    const forward = () => abort.abort();
    external?.addEventListener('abort', forward, { once: true });
    if (external?.aborted) abort.abort();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    timer.unref?.();
    let runner: QueryRunner | undefined;
    let temp = '';
    let transaction = false;
    let clean = true;
    let failureCode: string | undefined;
    const budget = { rows: 0, bytes: 0 };
    try {
      await this.validateLease(grant, abort.signal, deadline);
      runner = this.dataSource.createQueryRunner();
      await runner.connect();
      this.active(abort.signal, deadline);
      temp = `${this.options.participantId
        .replace(/-/g, '_')
        .slice(0, 16)}_export_scope_${randomUUID().replace(/-/g, '')}`;
      await runner.query(
        `CREATE TEMP TABLE "${temp}" ("id" uuid PRIMARY KEY) ON COMMIT PRESERVE ROWS`
      );
      await runner.startTransaction('REPEATABLE READ');
      transaction = true;
      await runner.query('SET TRANSACTION READ ONLY');
      await runner.query(`SET LOCAL statement_timeout = '10s'`);
      await runner.query(`SET LOCAL lock_timeout = '2s'`);
      const [{ snapshotAt } = {}] = await this.query(
        runner,
        'SELECT transaction_timestamp()::text AS "snapshotAt"',
        [],
        abort.signal,
        deadline
      );
      if (
        typeof snapshotAt !== 'string' ||
        !Number.isFinite(Date.parse(snapshotAt))
      )
        throw new AccountExportPostgresOwnerError('OWNER_READ_FAILED');
      await this.identities.readIdentities(
        grant,
        descriptor,
        async (ids) =>
          this.insertIds(runner!, temp, ids, abort.signal, deadline),
        abort.signal
      );
      const allSources = this.options.createSources(temp);
      if (!this.validFactorySources(allSources))
        throw new AccountExportPostgresOwnerError('OWNER_READ_FAILED');
      const sources = allSources.filter((source) =>
        requested.includes(source.source)
      );
      if (
        sources.length !== requested.length ||
        sources.some((source, index) => source.source !== requested[index])
      )
        throw new AccountExportPostgresOwnerError('OWNER_READ_FAILED');
      const emitter = new AccountExportOwnerEmitter<string>(
        {
          participantId: this.options.participantId,
          accountId: grant.accountId,
          captureId: randomUUID(),
          snapshotAt,
          sources: sources.map((s) => s.source),
          signal: abort.signal,
        },
        async (chunk) => {
          try {
            await this.validateLease(grant, abort.signal, deadline);
          } catch (error) {
            if (error instanceof AccountExportPostgresOwnerError)
              failureCode = error.code;
            throw error;
          }
          this.active(abort.signal, deadline);
          try {
            await this.awaitCallback(
              () => onChunk(chunk, abort.signal),
              abort.signal,
              deadline
            );
          } catch (error) {
            if (
              error instanceof AccountExportPostgresOwnerError &&
              ['OWNER_CAPTURE_TIMEOUT', 'OWNER_CAPTURE_ABORTED'].includes(
                error.code
              )
            )
              throw error;
            failureCode = 'OWNER_STREAM_CONSUMER_FAILED';
            throw new AccountExportPostgresOwnerError(failureCode);
          }
          this.active(abort.signal, deadline);
        }
      );
      await emitter.emitSources(
        Object.fromEntries(
          sources.map((source) => [
            source.source,
            () =>
              this.streamSource(
                runner!,
                source,
                grant.accountId,
                abort.signal,
                deadline,
                budget
              ),
          ])
        )
      );
      this.active(abort.signal, deadline);
      await runner.commitTransaction();
      transaction = false;
      await runner.query(`DROP TABLE IF EXISTS "${temp}"`);
      temp = '';
      await runner.release();
      runner = undefined;
      await this.validateLease(grant, abort.signal, deadline);
      this.active(abort.signal, deadline);
      return await emitter.complete();
    } catch (error) {
      if (abort.signal.aborted)
        throw new AccountExportPostgresOwnerError(
          external?.aborted ? 'OWNER_CAPTURE_ABORTED' : 'OWNER_CAPTURE_TIMEOUT'
        );
      if (error instanceof AccountExportPostgresOwnerError) throw error;
      if (
        error instanceof Error &&
        error.name === 'AccountExportOwnerEmitterError' &&
        failureCode
      )
        throw new AccountExportPostgresOwnerError(failureCode);
      throw new AccountExportPostgresOwnerError('OWNER_READ_FAILED');
    } finally {
      clearTimeout(timer);
      external?.removeEventListener('abort', forward);
      if (runner) {
        try {
          if (transaction) await runner.rollbackTransaction();
        } catch {
          clean = false;
        }
        try {
          if (temp) await runner.query(`DROP TABLE IF EXISTS "${temp}"`);
        } catch {
          clean = false;
        }
        if (clean) {
          try {
            await runner.release();
          } catch {
            clean = false;
          }
        }
        if (!clean) {
          this.quarantined = true;
          const evict = (
            runner as unknown as {
              releasePostgresConnection?: (error: Error) => Promise<void>;
            }
          ).releasePostgresConnection;
          if (typeof evict === 'function') {
            try {
              await evict.call(
                runner,
                new Error('ACCOUNT_EXPORT_CLEANUP_FAILED')
              );
              runner = undefined;
            } catch {
              /* quarantine remains */
            }
          }
        }
      }
      if (!clean) this.quarantined = true;
      this.busy = false;
    }
  }

  private async *streamSource(
    runner: QueryRunner,
    source: AccountExportPostgresSource,
    accountId: string,
    signal: AbortSignal,
    deadline: number,
    budget: { rows: number; bytes: number }
  ): AsyncIterable<AccountExportOwnerRecord<string>> {
    let cursor = '';
    while (true) {
      const rows = await this.query(
        runner,
        source.sql,
        [accountId, cursor, PAGE + 1],
        signal,
        deadline
      );
      if (!Array.isArray(rows) || rows.length > PAGE + 1)
        throw new AccountExportPostgresOwnerError('OWNER_READ_FAILED');
      for (const row of rows.slice(0, PAGE)) {
        this.active(signal, deadline);
        let data: Record<string, unknown>;
        try {
          data = source.project(row, accountId);
        } catch {
          throw new AccountExportPostgresOwnerError('OWNER_READ_FAILED');
        }
        const id = data?.['id'];
        if (typeof id !== 'string' || !id || id <= cursor)
          throw new AccountExportPostgresOwnerError(
            'OWNER_RELATIONSHIP_AMBIGUOUS'
          );
        let size: number;
        try {
          size = new TextEncoder().encode(
            JSON.stringify({ source: source.source, data })
          ).byteLength;
        } catch {
          throw new AccountExportPostgresOwnerError('OWNER_READ_FAILED');
        }
        budget.rows++;
        budget.bytes += size;
        if (
          size > 512 * 1024 ||
          budget.rows > MAX_CAPTURE_ROWS ||
          budget.bytes > MAX_CAPTURE_BYTES
        )
          throw new AccountExportPostgresOwnerError('OWNER_READ_FAILED');
        yield { source: source.source, data };
        cursor = id;
      }
      if (rows.length <= PAGE) break;
    }
  }

  private async insertIds(
    runner: QueryRunner,
    temp: string,
    ids: readonly string[],
    signal: AbortSignal,
    deadline: number
  ): Promise<void> {
    this.active(signal, deadline);
    if (
      !Array.isArray(ids) ||
      ids.length > ACCOUNT_EXPORT_SNAPSHOT_LIMITS.identityPageSize ||
      ids.some((id) => typeof id !== 'string' || !UUID.test(id))
    )
      throw new AccountExportPostgresOwnerError('OWNER_RELATIONSHIP_AMBIGUOUS');
    if (ids.length)
      await this.query(
        runner,
        `INSERT INTO "${temp}" ("id") SELECT unnest($1::uuid[])`,
        [ids],
        signal,
        deadline
      );
    this.active(signal, deadline);
  }

  private async query(
    runner: QueryRunner,
    sql: string,
    params: unknown[],
    signal: AbortSignal,
    deadline: number
  ): Promise<Record<string, unknown>[]> {
    this.active(signal, deadline);
    try {
      const rows = await runner.query(sql, params);
      this.active(signal, deadline);
      if (!Array.isArray(rows)) throw new Error('invalid rows');
      return rows as Record<string, unknown>[];
    } catch (error) {
      if (error instanceof AccountExportPostgresOwnerError) throw error;
      throw new AccountExportPostgresOwnerError('OWNER_READ_FAILED');
    }
  }

  private async validateLease(
    grant: AccountExportCaptureGrant,
    signal: AbortSignal,
    deadline: number
  ): Promise<void> {
    this.active(signal, deadline);
    let response: unknown;
    try {
      response = await firstValueFrom(
        this.authClient
          .send({ cmd: AuthCommands.ValidateAccountExportLease }, grant)
          .pipe(timeout(3000))
      );
    } catch {
      throw new AccountExportPostgresOwnerError('OWNER_AUTHORIZATION_FAILED');
    }
    this.active(signal, deadline);
    if (
      !response ||
      typeof response !== 'object' ||
      Object.keys(response).length !== 1 ||
      (response as { valid?: unknown }).valid !== true
    )
      throw new AccountExportPostgresOwnerError('OWNER_AUTHORIZATION_FAILED');
  }

  private async awaitCallback(
    callback: () => Promise<void>,
    signal: AbortSignal,
    deadline: number
  ): Promise<void> {
    this.active(signal, deadline);
    let onAbort: (() => void) | undefined;
    const aborted = new Promise<never>((_resolve, reject) => {
      onAbort = () =>
        reject(
          new AccountExportPostgresOwnerError(
            Date.now() >= deadline
              ? 'OWNER_CAPTURE_TIMEOUT'
              : 'OWNER_CAPTURE_ABORTED'
          )
        );
      signal.addEventListener('abort', onAbort, { once: true });
    });
    try {
      await Promise.race([Promise.resolve().then(callback), aborted]);
      this.active(signal, deadline);
    } finally {
      if (onAbort) signal.removeEventListener('abort', onAbort);
    }
  }

  private active(signal: AbortSignal, deadline: number): void {
    if (signal.aborted || Date.now() >= deadline)
      throw new AccountExportPostgresOwnerError(
        Date.now() >= deadline
          ? 'OWNER_CAPTURE_TIMEOUT'
          : 'OWNER_CAPTURE_ABORTED'
      );
  }

  private validRequestedSources(sources: readonly string[]): boolean {
    return (
      Array.isArray(sources) &&
      sources.length > 0 &&
      sources.length <= this.options.sources.length &&
      new Set(sources).size === sources.length &&
      sources.every((source) => this.options.sources.includes(source))
    );
  }
  private validGrant(value: unknown): value is AccountExportCaptureGrant {
    if (
      !isAccountExportCaptureGrant(value) ||
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value)
    )
      return false;
    const keys = Object.keys(value).sort();
    return (
      JSON.stringify(keys) ===
      JSON.stringify(
        ['accountId', 'appId', 'attempt', 'jobId', 'leaseOwner', 'token'].sort()
      )
    );
  }
  private validFactorySources(sources: AccountExportPostgresSource[]): boolean {
    return (
      Array.isArray(sources) &&
      sources.length === this.options.sources.length &&
      sources.every(
        (source, index) =>
          !!source &&
          IDENTIFIER.test(source.source) &&
          source.source === this.options.sources[index] &&
          typeof source.sql === 'string' &&
          typeof source.project === 'function'
      )
    );
  }
  private copyDescriptor(
    d: AccountExportSnapshotDescriptor
  ): AccountExportSnapshotDescriptor {
    return {
      handleId: d.handleId,
      participantId: d.participantId,
      accountId: d.accountId,
      captureId: d.captureId,
      snapshotAt: d.snapshotAt,
      sizeBytes: d.sizeBytes,
      sha256: d.sha256,
      rowCount: d.rowCount,
      sources: [...d.sources],
      sourceRowCounts: { ...d.sourceRowCounts },
      sourceDispositions: { ...d.sourceDispositions },
      identityCount: d.identityCount,
      expiresAt: d.expiresAt,
    };
  }
  private validDescriptor(
    value: unknown
  ): value is AccountExportSnapshotDescriptor {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return false;
    const d = value as AccountExportSnapshotDescriptor;
    return (
      d.participantId === 'profile' &&
      UUID.test(d.accountId) &&
      UUID.test(d.captureId) &&
      UUID.test(d.handleId) &&
      Array.isArray(d.sources) &&
      d.sources.length <= 100 &&
      d.sources.every(
        (source) => typeof source === 'string' && IDENTIFIER.test(source)
      ) &&
      Number.isSafeInteger(d.sizeBytes) &&
      d.sizeBytes >= 0 &&
      Number.isSafeInteger(d.rowCount) &&
      d.rowCount >= 0 &&
      d.sourceRowCounts !== null &&
      typeof d.sourceRowCounts === 'object' &&
      d.sourceDispositions !== null &&
      typeof d.sourceDispositions === 'object' &&
      Number.isSafeInteger(d.identityCount) &&
      d.identityCount >= 0 &&
      d.identityCount <=
        ACCOUNT_EXPORT_SNAPSHOT_LIMITS.identityPageSize *
          ACCOUNT_EXPORT_SNAPSHOT_LIMITS.identityPages &&
      typeof d.sha256 === 'string' &&
      /^[a-f0-9]{64}$/i.test(d.sha256) &&
      Number.isFinite(Date.parse(d.snapshotAt)) &&
      Number.isFinite(Date.parse(d.expiresAt))
    );
  }
}
