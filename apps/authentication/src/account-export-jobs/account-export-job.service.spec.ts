import { RpcException } from '@nestjs/microservices';
import { DataSource } from 'typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ACCOUNT_EXPORT_COVERAGE_INVENTORY,
  ACCOUNT_EXPORT_OWNER_CONTRACT_VERSION,
  ACCOUNT_EXPORT_OWNER_SCHEMA_VERSION,
  AccountExportOwnerChunk,
  AccountExportJobStatus,
} from '@optimistic-tanuki/models';
import { AccountExportOwnerSpoolService } from '@optimistic-tanuki/storage';
import {
  AUTHENTICATION_ACCOUNT_EXPORT_SOURCES,
  AuthenticationAccountExportSource,
} from '../account-export-owner/account-export-owner.service';
import { AccountExportJobEntity } from './entities/account-export-job.entity';
import { AccountExportJobService } from './account-export-job.service';

const ACCOUNT_ID = 'd816be66-4fb6-4ed6-a91d-cc058bd5c816';
const IDEMPOTENCY_KEY = '67e12d87-82e8-442f-99e9-921c01f2d690';
const TOKEN = 'transient-session-token';

describe('AccountExportJobService authorization boundary', () => {
  const jobs = {};
  const dataSource = { transaction: jest.fn() };
  const auth = { validateToken: jest.fn() };
  const preview = { previewAccountExport: jest.fn() };
  let service: AccountExportJobService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AccountExportJobService(
      jobs as never,
      dataSource as never,
      auth as never,
      preview as never,
      {} as never,
      {} as never,
      {} as never
    );
  });

  it('rejects malformed account or idempotency keys before session lookup', async () => {
    await expect(
      service.create({
        accountId: 'not-a-uuid',
        token: TOKEN,
        appId: 'client-interface',
        idempotencyKey: IDEMPOTENCY_KEY,
      })
    ).rejects.toBeInstanceOf(RpcException);
    await expect(
      service.create({
        accountId: ACCOUNT_ID,
        token: TOKEN,
        appId: 'client-interface',
        idempotencyKey: 'not-a-uuid',
      })
    ).rejects.toBeInstanceOf(RpcException);
    expect(auth.validateToken).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects a session whose authenticated subject differs from the requested account', async () => {
    auth.validateToken.mockResolvedValue({
      isValid: true,
      data: {
        userId: 'a40b2c3a-5648-47e2-8c35-e9d4a54ef67d',
        appId: 'client-interface',
      },
    });
    await expect(
      service.create({
        accountId: ACCOUNT_ID,
        token: TOKEN,
        appId: 'client-interface',
        idempotencyKey: IDEMPOTENCY_KEY,
      })
    ).rejects.toBeInstanceOf(RpcException);
    expect(auth.validateToken).toHaveBeenCalledWith(TOKEN, 'client-interface');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects a valid session presented in a different app scope with a stable RPC error', async () => {
    auth.validateToken.mockResolvedValue({
      isValid: true,
      data: { userId: ACCOUNT_ID, appId: 'different-app' },
    });
    const failure = await service
      .create({
        accountId: ACCOUNT_ID,
        token: TOKEN,
        appId: 'client-interface',
        idempotencyKey: IDEMPOTENCY_KEY,
      })
      .catch((error) => error as RpcException);
    if (!(failure instanceof RpcException)) throw failure;
    expect(failure.getError()).toMatchObject({
      contractVersion: 1,
      statusCode: 403,
      code: 'EXPORT_JOB_SESSION_INVALID',
    });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});

describe('AccountExportJobService Authentication owner staging', () => {
  let root: string;
  let spool: AccountExportOwnerSpoolService;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'ot-account-job-spool-test-'));
    spool = new AccountExportOwnerSpoolService();
    const capture = spool.capture.bind(spool);
    spool.capture = (options, producer) =>
      capture({ ...options, spoolRoot: root }, producer);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  function createOwnerChunks(
    accountId: string
  ): AccountExportOwnerChunk<AuthenticationAccountExportSource>[] {
    const captureId = randomUUID();
    const snapshotAt = '2026-10-19T16:00:00.000Z';
    const common = {
      contractVersion: ACCOUNT_EXPORT_OWNER_CONTRACT_VERSION,
      schemaVersion: ACCOUNT_EXPORT_OWNER_SCHEMA_VERSION,
      participantId: 'authentication',
      accountId,
      captureId,
      snapshotAt,
      endOfStream: false,
      complete: false,
      uncovered: [] as string[],
    };
    const dataRecord = {
      source: 'user' as const,
      data: { id: accountId, accountId, email: 'PRIVATE-OWNER-DATA-CANARY' },
    };
    const checksum = createHash('sha256')
      .update(`${JSON.stringify(dataRecord)}\n`)
      .digest('hex');
    const counts: Partial<Record<AuthenticationAccountExportSource, number>> =
      {};
    const dispositions: Partial<
      Record<AuthenticationAccountExportSource, string>
    > = {};
    const chunks: AccountExportOwnerChunk<AuthenticationAccountExportSource>[] =
      [];
    let ordinal = 0;
    for (const source of AUTHENTICATION_ACCOUNT_EXPORT_SOURCES) {
      const records = source === 'user' ? [dataRecord] : [];
      counts[source] = records.length;
      dispositions[source] = records.length ? 'retained' : 'none-retained';
      chunks.push({
        ...common,
        pageOrdinal: ++ordinal,
        source,
        cursor: records.length ? accountId : null,
        records,
        sourceComplete: true,
      });
    }
    chunks.push({
      ...common,
      pageOrdinal: ++ordinal,
      source: 'end',
      cursor: null,
      records: [],
      sourceComplete: true,
      endOfStream: true,
      complete: true,
      rowCount: 1,
      checksum,
      sourceRowCounts: counts,
      sourceDispositions: dispositions,
    });
    return chunks;
  }

  async function activeSpoolFiles(): Promise<number> {
    if (process.platform !== 'linux') return 0;
    let count = 0;
    for (const descriptor of await readdir('/proc/self/fd')) {
      try {
        const target = await readlink(`/proc/self/fd/${descriptor}`);
        if (
          target.startsWith(join(root, 'ot-owner-spool-')) &&
          target.endsWith('(deleted)')
        )
          count++;
      } catch {
        // Descriptors can close while this test inspects the table.
      }
    }
    return count;
  }

  function harness(
    renew: (claim: AccountExportJobEntity) => Promise<boolean>,
    ownerCapture: jest.Mock
  ): {
    run: (
      input: Record<string, string>,
      claim: AccountExportJobEntity
    ) => Promise<AccountExportJobStatus>;
    finish: jest.Mock;
    renewLease: jest.Mock;
    profileCapture: jest.Mock;
    profileCleanup: jest.Mock;
  } {
    const jobs = {};
    const auth = {};
    const preview = {
      previewAccountExport: jest.fn().mockResolvedValue({
        contractVersion: 1,
        accountId: ACCOUNT_ID,
        status: 'EXPORT_INCOMPLETE',
        complete: false,
        downloadable: false,
        coverage: {
          coverageVersion: ACCOUNT_EXPORT_COVERAGE_INVENTORY.version,
          complete: false,
          blockers: ['preview-incomplete'],
        },
        participants: [],
      }),
    };
    const owner = { captureAccount: ownerCapture };
    const profileResult = {
      identities: jest.fn(async () => ({})),
      cleanup: jest.fn(async () => undefined),
    };
    const profileCapture = { capture: jest.fn(async () => profileResult) };
    const service = new AccountExportJobService(
      jobs as never,
      {} as never,
      auth as never,
      preview as never,
      owner as never,
      spool,
      profileCapture as never
    );
    const state = service as unknown as {
      run: (
        input: Record<string, string>,
        claim: AccountExportJobEntity
      ) => Promise<AccountExportJobStatus>;
      claim: jest.Mock;
      renewLease: jest.Mock;
      finish: jest.Mock;
    };
    state.claim = jest.fn().mockImplementation(async () => activeClaim);
    state.renewLease = jest.fn(renew);
    state.finish = jest.fn(async (_claim, nextState, summary, errorCode) => {
      const updated = Object.assign(activeClaim, {
        state: nextState,
        coverageSummary: summary,
        lastErrorCode: errorCode,
        leaseOwner: null,
        leaseExpiresAt: null,
        completedAt: null,
      });
      expect(await activeSpoolFiles()).toBe(0);
      return updated;
    });
    return {
      run: (input, claim) => state.run(input, claim),
      finish: state.finish,
      renewLease: state.renewLease,
      profileCapture: profileCapture.capture,
      profileCleanup: profileResult.cleanup,
    };
  }

  let activeClaim: AccountExportJobEntity;
  beforeEach(() => {
    activeClaim = Object.assign(new AccountExportJobEntity(), {
      id: randomUUID(),
      accountId: ACCOUNT_ID,
      appId: 'client-interface',
      kind: 'export',
      idempotencyKey: IDEMPOTENCY_KEY,
      state: 'running',
      attempt: 2,
      leaseOwner: randomUUID(),
      leaseExpiresAt: new Date(Date.now() + 60_000),
      coverageVersion: ACCOUNT_EXPORT_COVERAGE_INVENTORY.version,
      coverageSummary: { blockers: ['not-started'], artifactAvailable: false },
      createdAt: new Date('2026-10-19T15:00:00.000Z'),
      updatedAt: new Date('2026-10-19T15:00:00.000Z'),
      completedAt: null,
    });
  });

  const input = () => ({
    accountId: ACCOUNT_ID,
    token: TOKEN,
    appId: 'client-interface',
    idempotencyKey: IDEMPOTENCY_KEY,
  });

  it('stores verified Authentication and Profile owner markers and keeps the global job incomplete', async () => {
    const ownerCapture = jest.fn(
      async ({
        onChunk,
        signal,
      }: {
        onChunk: (
          chunk: AccountExportOwnerChunk<AuthenticationAccountExportSource>,
          signal?: AbortSignal
        ) => Promise<void>;
        signal?: AbortSignal;
      }) => {
        const chunks = createOwnerChunks(ACCOUNT_ID);
        for (const [index, chunk] of chunks.entries()) {
          await onChunk(chunk, signal);
          if (index === 0) expect(await activeSpoolFiles()).toBe(1);
        }
        return chunks[chunks.length - 1];
      }
    );
    const test = harness(async () => true, ownerCapture);
    const result = await test.run(input(), activeClaim);
    expect(result.state).toBe('incomplete');
    expect(result.artifactUrl).toBeNull();
    expect(result.coverageSummary).toMatchObject({
      capturedDatabaseOwners: ['authentication', 'profile'],
      artifactAvailable: false,
    });
    expect(test.renewLease).toHaveBeenCalledTimes(
      1 + AUTHENTICATION_ACCOUNT_EXPORT_SOURCES.length + 1
    );
    expect(JSON.stringify(result)).not.toContain('PRIVATE-OWNER-DATA-CANARY');
    expect(JSON.stringify(result)).not.toMatch(
      /sha256|captureId|sizeBytes|stage/i
    );
  });

  it.each(['capture', 'cleanup', 'lease'])(
    'fails safely when Profile %s fails after Authentication staging',
    async (mode) => {
      const owner = jest.fn(async ({ onChunk }) => {
        const chunks = createOwnerChunks(ACCOUNT_ID);
        for (const chunk of chunks) await onChunk(chunk);
        return chunks[chunks.length - 1];
      });
      const test = harness(async () => true, owner);
      if (mode === 'capture')
        test.profileCapture.mockRejectedValueOnce(
          new Error('private remote diagnostic')
        );
      if (mode === 'cleanup')
        test.profileCleanup.mockRejectedValueOnce(
          new Error('private cleanup diagnostic')
        );
      if (mode === 'lease') {
        test.profileCapture.mockImplementationOnce(async (_grant, renew) => {
          test.renewLease.mockResolvedValueOnce(false);
          await renew();
          throw new Error('private stale lease diagnostic');
        });
        await expect(test.run(input(), activeClaim)).rejects.toMatchObject({
          message: 'Export operation lease is no longer current',
        });
        expect(test.finish).not.toHaveBeenCalled();
        return;
      }
      const result = await test.run(input(), activeClaim);
      expect(result.state).toBe('failed');
      expect(result.coverageSummary.capturedDatabaseOwners).toEqual([
        'authentication',
      ]);
      expect(result.coverageSummary.blockers).toContain(
        'profile-capture-unavailable'
      );
      expect(JSON.stringify(result)).not.toContain('private');
      expect(result.artifactUrl).toBeNull();
    }
  );

  it('discards partial staging and records only a stable failure code when owner capture fails', async () => {
    const ownerCapture = jest.fn(
      async ({
        onChunk,
        signal,
      }: {
        onChunk: (
          chunk: AccountExportOwnerChunk<AuthenticationAccountExportSource>,
          signal?: AbortSignal
        ) => Promise<void>;
        signal?: AbortSignal;
      }) => {
        const first = createOwnerChunks(ACCOUNT_ID)[0];
        await onChunk(first, signal);
        expect(await activeSpoolFiles()).toBe(1);
        throw new Error('PRIVATE-RAW-CAPTURE-FAILURE');
      }
    );
    const test = harness(async () => true, ownerCapture);
    const result = await test.run(input(), activeClaim);
    expect(result.state).toBe('failed');
    expect(result.coverageSummary).toMatchObject({
      blockers: expect.arrayContaining(['owner-capture-unavailable']),
    });
    expect(result.coverageSummary).not.toHaveProperty('capturedDatabaseOwners');
    expect(JSON.stringify(result)).not.toContain('PRIVATE-RAW-CAPTURE-FAILURE');
    expect(await readdir(root)).toEqual([]);
  });

  it('stops a stale lease attempt, discards staged bytes, and never finishes it', async () => {
    const ownerCapture = jest.fn(
      async ({
        onChunk,
        signal,
      }: {
        onChunk: (
          chunk: AccountExportOwnerChunk<AuthenticationAccountExportSource>,
          signal?: AbortSignal
        ) => Promise<void>;
        signal?: AbortSignal;
      }) => {
        const chunks = createOwnerChunks(ACCOUNT_ID);
        await onChunk(chunks[0], signal);
        expect(await activeSpoolFiles()).toBe(1);
        await onChunk(chunks[1], signal);
        return chunks[chunks.length - 1];
      }
    );
    let renewal = 0;
    const test = harness(async () => ++renewal === 1, ownerCapture);
    const error = await test
      .run(input(), activeClaim)
      .catch((failure) => failure as RpcException);
    expect(error).toBeInstanceOf(RpcException);
    expect((error as RpcException).getError()).toMatchObject({
      code: 'EXPORT_JOB_LEASE_LOST',
    });
    expect(test.finish).not.toHaveBeenCalled();
    expect(await readdir(root)).toEqual([]);
  });

  it('renews only the still-current, unexpired attempt and lease nonce', async () => {
    const builder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const service = new AccountExportJobService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      spool,
      {} as never
    );
    const internals = service as unknown as {
      renewLease(claim: AccountExportJobEntity): Promise<boolean>;
    };
    (service as unknown as { jobs: { createQueryBuilder: jest.Mock } }).jobs = {
      createQueryBuilder: jest.fn(() => builder),
    };
    expect(await internals.renewLease(activeClaim)).toBe(true);
    expect(builder.set).toHaveBeenCalledWith({
      leaseExpiresAt: expect.any(Function),
    });
    expect(builder.where).toHaveBeenCalledWith(
      expect.stringContaining(
        'attempt = :attempt AND leaseOwner = :owner AND leaseExpiresAt > clock_timestamp()'
      ),
      {
        id: activeClaim.id,
        running: 'running',
        attempt: activeClaim.attempt,
        owner: activeClaim.leaseOwner,
      }
    );
    builder.execute.mockResolvedValue({ affected: 0 });
    expect(await internals.renewLease(activeClaim)).toBe(false);
  });
});

describe('AccountExportJobService database lease fence', () => {
  const enabled =
    process.env.ACCOUNT_EXPORT_JOB_DB_MARKER ===
      'account-export-job-loopback-v1' &&
    process.env.ACCOUNT_EXPORT_JOB_DB_HOST === '127.0.0.1';
  const suite = enabled ? describe : describe.skip;
  suite('real PostgreSQL conditional acknowledgements', () => {
    let dataSource: DataSource;
    let service: AccountExportJobService;
    const ids: string[] = [];

    beforeAll(async () => {
      dataSource = new DataSource({
        type: 'postgres',
        host: process.env.ACCOUNT_EXPORT_JOB_DB_HOST,
        port: Number(process.env.ACCOUNT_EXPORT_JOB_DB_PORT),
        username: process.env.ACCOUNT_EXPORT_JOB_DB_USER,
        password: process.env.ACCOUNT_EXPORT_JOB_DB_PASSWORD,
        database: process.env.ACCOUNT_EXPORT_JOB_DB_NAME,
        entities: [AccountExportJobEntity],
      });
      await dataSource.initialize();
      const repository = dataSource.getRepository(AccountExportJobEntity);
      service = new AccountExportJobService(
        repository,
        dataSource,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never
      );
    });

    afterAll(async () => {
      if (!dataSource?.isInitialized) return;
      if (ids.length)
        await dataSource.getRepository(AccountExportJobEntity).delete(ids);
      await dataSource.destroy();
    });

    const finish = (claim: AccountExportJobEntity) =>
      (
        service as unknown as {
          finish(
            row: AccountExportJobEntity,
            state: 'incomplete',
            summary: Record<string, unknown>,
            error: null
          ): Promise<AccountExportJobEntity>;
        }
      ).finish(
        claim,
        'incomplete',
        { blockers: ['test-only'], artifactAvailable: false },
        null
      );

    const renewLease = (claim: AccountExportJobEntity) =>
      (
        service as unknown as {
          renewLease(row: AccountExportJobEntity): Promise<boolean>;
        }
      ).renewLease(claim);

    it('renews only the current running attempt with its nonce and live lease', async () => {
      const repository = dataSource.getRepository(AccountExportJobEntity);
      const id = randomUUID();
      ids.push(id);
      const row = await repository.save(
        repository.create({
          id,
          accountId: randomUUID(),
          appId: 'client-interface',
          kind: 'export',
          idempotencyKey: randomUUID(),
          state: 'running',
          attempt: 4,
          leaseOwner: randomUUID(),
          leaseExpiresAt: new Date(Date.now() + 30_000),
          coverageVersion: '2026-10-17.v1',
          coverageSummary: {
            blockers: ['renewal-test'],
            artifactAvailable: false,
          },
        })
      );
      expect(await renewLease(row)).toBe(true);
      const renewed = await repository.findOneByOrFail({ id });
      expect(renewed.leaseExpiresAt).not.toBeNull();
      const [leaseCheck] = await dataSource.query(
        'SELECT "leaseExpiresAt" > clock_timestamp() + INTERVAL \'50 seconds\' AS renewed FROM "account_export_jobs" WHERE id = $1',
        [id]
      );
      expect(leaseCheck.renewed).toBe(true);

      const expectUnchanged = async (
        claim: AccountExportJobEntity,
        expected: AccountExportJobEntity
      ) => {
        expect(await renewLease(claim)).toBe(false);
        const actual = await repository.findOneByOrFail({ id });
        expect(actual).toEqual(expected);
      };
      await expectUnchanged(
        { ...renewed, attempt: renewed.attempt + 1 },
        renewed
      );
      await expectUnchanged({ ...renewed, leaseOwner: randomUUID() }, renewed);

      await repository.update(id, {
        leaseExpiresAt: new Date(Date.now() - 60_000),
      });
      const expired = await repository.findOneByOrFail({ id });
      await expectUnchanged(expired, expired);

      await repository.update(id, {
        state: 'incomplete',
        leaseExpiresAt: new Date(Date.now() + 60_000),
      });
      const nonRunning = await repository.findOneByOrFail({ id });
      await expectUnchanged(nonRunning, nonRunning);
    });

    it('does not let an older attempt and lease nonce overwrite a reclaimed job', async () => {
      const repository = dataSource.getRepository(AccountExportJobEntity);
      const id = randomUUID();
      ids.push(id);
      const row = await repository.save(
        repository.create({
          id,
          accountId: randomUUID(),
          appId: 'client-interface',
          kind: 'export',
          idempotencyKey: randomUUID(),
          state: 'running',
          attempt: 8,
          leaseOwner: randomUUID(),
          leaseExpiresAt: new Date(Date.now() + 60_000),
          coverageVersion: '2026-10-17.v1',
          coverageSummary: {
            blockers: ['new-attempt'],
            artifactAvailable: false,
          },
        })
      );
      const older = { ...row, attempt: 7, leaseOwner: randomUUID() };
      await finish(older);
      const unchanged = await repository.findOneByOrFail({ id });
      expect(unchanged).toMatchObject({
        state: 'running',
        attempt: 8,
        leaseOwner: row.leaseOwner,
        coverageSummary: {
          blockers: ['new-attempt'],
          artifactAvailable: false,
        },
      });
    });

    it('does not accept an acknowledgement after its own lease expires', async () => {
      const repository = dataSource.getRepository(AccountExportJobEntity);
      const id = randomUUID();
      ids.push(id);
      const row = await repository.save(
        repository.create({
          id,
          accountId: randomUUID(),
          appId: 'client-interface',
          kind: 'export',
          idempotencyKey: randomUUID(),
          state: 'running',
          attempt: 3,
          leaseOwner: randomUUID(),
          leaseExpiresAt: new Date(Date.now() - 1000),
          coverageVersion: '2026-10-17.v1',
          coverageSummary: { blockers: ['expired'], artifactAvailable: false },
        })
      );
      await finish(row);
      const unchanged = await repository.findOneByOrFail({ id });
      expect(unchanged).toMatchObject({
        state: 'running',
        attempt: 3,
        leaseOwner: row.leaseOwner,
        coverageSummary: { blockers: ['expired'], artifactAvailable: false },
      });
    });
  });
});
