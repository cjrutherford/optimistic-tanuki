import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  AuthCommands,
  SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES,
} from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportOwnerChunk,
  AccountExportOwnerRecord,
  AccountExportSnapshotDescriptor,
  ACCOUNT_EXPORT_SNAPSHOT_LIMITS,
  isAccountExportCaptureGrant,
} from '@optimistic-tanuki/models';
import {
  AccountExportOwnerEmitter,
  AccountExportProfileSnapshotClient,
} from '@optimistic-tanuki/storage';
import { firstValueFrom, timeout } from 'rxjs';
import { DataSource, QueryRunner } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { SocialCaptureSource } from './account-export-authored.sources';
import { createSocialAccountExportSources } from './account-export-sources';

export type SocialAccountExportSource = string;
export type SocialAccountExportChunk = AccountExportOwnerChunk<string>;
export interface SocialAccountExportOptions {
  grant: AccountExportCaptureGrant;
  profileSnapshot: AccountExportSnapshotDescriptor;
  onChunk: (
    chunk: SocialAccountExportChunk,
    signal?: AbortSignal
  ) => Promise<void>;
  signal?: AbortSignal;
  captureTimeoutMs?: number;
  sources?: (profileTable: string) => SocialCaptureSource[];
}

export class SocialAccountExportOwnerError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'SocialAccountExportOwnerError';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = 200;
const MAX_CAPTURE_ROWS = 100_000;
const MAX_CAPTURE_BYTES = 64 * 1024 * 1024;
@Injectable()
export class SocialAccountExportOwnerService {
  private busy = false;
  private quarantined = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly identities: AccountExportProfileSnapshotClient,
    private readonly authClient: ClientProxy
  ) {}

  async captureAccount(
    value: SocialAccountExportOptions
  ): Promise<SocialAccountExportChunk> {
    if (this.busy || this.quarantined)
      throw new SocialAccountExportOwnerError('OWNER_READ_FAILED');
    if (
      !value ||
      !isAccountExportCaptureGrant(value.grant) ||
      !this.validDescriptor(value.profileSnapshot) ||
      value.profileSnapshot.accountId !== value.grant.accountId ||
      typeof value.onChunk !== 'function'
    )
      throw new SocialAccountExportOwnerError('OWNER_AUTHORIZATION_FAILED');
    const grant = {
      ...value.grant,
      accountId: value.grant.accountId.toLowerCase(),
    };
    const d = value.profileSnapshot;
    const descriptor: AccountExportSnapshotDescriptor = {
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
    const sourcesFactory = value.sources ?? createSocialAccountExportSources;
    const onChunk = value.onChunk;
    const external = value.signal;
    const timeoutMs = value.captureTimeoutMs ?? 45_000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 45_000)
      throw new SocialAccountExportOwnerError('OWNER_AUTHORIZATION_FAILED');
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
      temp = `social_export_scope_${randomUUID().replace(/-/g, '')}`;
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
        throw new SocialAccountExportOwnerError('OWNER_READ_FAILED');
      await this.identities.readIdentities(
        grant,
        descriptor,
        async (ids) =>
          this.insertIds(runner!, temp, ids, abort.signal, deadline),
        abort.signal
      );

      const sources = sourcesFactory(temp);
      const sourceNames = sources?.map((source) => source.source);
      if (
        !Array.isArray(sources) ||
        !sources.length ||
        sources.some(
          (s) =>
            !/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(s.source) ||
            !SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES.some(
              (registered) => registered === s.source
            ) ||
            typeof s.sql !== 'string' ||
            typeof s.project !== 'function'
        ) ||
        new Set(sourceNames).size !== sourceNames.length ||
        sourceNames.includes('end')
      )
        throw new SocialAccountExportOwnerError('OWNER_READ_FAILED');
      const emitter = new AccountExportOwnerEmitter<string>(
        {
          participantId: 'social',
          accountId: grant.accountId,
          captureId: randomUUID(),
          snapshotAt,
          sources: sourceNames,
          signal: abort.signal,
        },
        async (chunk) => {
          try {
            await this.validateLease(grant, abort.signal, deadline);
          } catch (error) {
            if (error instanceof SocialAccountExportOwnerError)
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
              error instanceof SocialAccountExportOwnerError &&
              ['OWNER_CAPTURE_TIMEOUT', 'OWNER_CAPTURE_ABORTED'].includes(
                error.code
              )
            )
              throw error;
            failureCode = 'OWNER_STREAM_CONSUMER_FAILED';
            throw new SocialAccountExportOwnerError(failureCode);
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
        throw new SocialAccountExportOwnerError(
          external?.aborted ? 'OWNER_CAPTURE_ABORTED' : 'OWNER_CAPTURE_TIMEOUT'
        );
      if (error instanceof SocialAccountExportOwnerError) throw error;
      if (
        error instanceof Error &&
        error.name === 'AccountExportOwnerEmitterError' &&
        failureCode
      )
        throw new SocialAccountExportOwnerError(failureCode);
      throw new SocialAccountExportOwnerError('OWNER_READ_FAILED');
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
                new Error('SOCIAL_ACCOUNT_EXPORT_CLEANUP_FAILED')
              );
              runner = undefined;
            } catch {
              /* quarantine remains until restart */
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
    source: SocialCaptureSource,
    accountId: string,
    signal: AbortSignal,
    deadline: number,
    budget: { rows: number; bytes: number }
  ): AsyncIterable<AccountExportOwnerRecord<string>> {
    let cursor: string | null = '';
    while (true) {
      const rows = await this.query(
        runner,
        source.sql,
        [accountId, cursor, PAGE + 1],
        signal,
        deadline
      );
      if (!Array.isArray(rows) || rows.length > PAGE + 1)
        throw new SocialAccountExportOwnerError('OWNER_READ_FAILED');
      for (const row of rows.slice(0, PAGE)) {
        this.active(signal, deadline);
        let data: Record<string, unknown>;
        try {
          data = source.project(row, accountId);
        } catch {
          throw new SocialAccountExportOwnerError('OWNER_READ_FAILED');
        }
        const id = data?.id;
        if (typeof id !== 'string' || !id || (cursor !== null && id <= cursor))
          throw new SocialAccountExportOwnerError(
            'OWNER_RELATIONSHIP_AMBIGUOUS'
          );
        const size = new TextEncoder().encode(
          JSON.stringify({ source: source.source, data })
        ).byteLength;
        budget.rows += 1;
        budget.bytes += size;
        if (budget.rows > MAX_CAPTURE_ROWS || budget.bytes > MAX_CAPTURE_BYTES)
          throw new SocialAccountExportOwnerError('OWNER_READ_FAILED');
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
      throw new SocialAccountExportOwnerError('OWNER_RELATIONSHIP_AMBIGUOUS');
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
      if (error instanceof SocialAccountExportOwnerError) throw error;
      throw new SocialAccountExportOwnerError('OWNER_READ_FAILED');
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
      throw new SocialAccountExportOwnerError('OWNER_AUTHORIZATION_FAILED');
    }
    this.active(signal, deadline);
    if (
      !response ||
      typeof response !== 'object' ||
      Object.keys(response).length !== 1 ||
      (response as { valid?: unknown }).valid !== true
    )
      throw new SocialAccountExportOwnerError('OWNER_AUTHORIZATION_FAILED');
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
          new SocialAccountExportOwnerError(
            Date.now() >= deadline
              ? 'OWNER_CAPTURE_TIMEOUT'
              : 'OWNER_CAPTURE_ABORTED'
          )
        );
      signal.addEventListener('abort', onAbort, { once: true });
    });
    try {
      // Promise.race attaches a rejection handler to the consumer even if abort wins.
      await Promise.race([Promise.resolve().then(callback), aborted]);
      this.active(signal, deadline);
    } finally {
      if (onAbort) signal.removeEventListener('abort', onAbort);
    }
  }

  private active(signal: AbortSignal, deadline: number): void {
    if (signal.aborted || Date.now() >= deadline)
      throw new SocialAccountExportOwnerError(
        Date.now() >= deadline
          ? 'OWNER_CAPTURE_TIMEOUT'
          : 'OWNER_CAPTURE_ABORTED'
      );
  }

  private validDescriptor(
    value: unknown
  ): value is AccountExportSnapshotDescriptor {
    const d = value as AccountExportSnapshotDescriptor | null;
    return (
      !!d &&
      d.participantId === 'profile' &&
      UUID.test(d.accountId) &&
      UUID.test(d.captureId) &&
      UUID.test(d.handleId) &&
      Array.isArray(d.sources) &&
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
