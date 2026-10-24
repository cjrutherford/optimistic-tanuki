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
import { ACCOUNT_EXPORT_RELEASE_SOURCE_REGISTRY } from './account-export-release-registry';

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
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
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

  it('rejects malformed, unauthenticated, cross-account, and unauthorized-app cancellations', async () => {
    const base = {
      accountId: ACCOUNT_ID,
      token: TOKEN,
      appId: 'client-interface',
      jobId: randomUUID(),
    };
    await expect(
      service.cancel({ ...base, jobId: 'bad' })
    ).rejects.toBeInstanceOf(RpcException);
    auth.validateToken.mockResolvedValue({ isValid: false });
    await expect(service.cancel(base)).rejects.toBeInstanceOf(RpcException);
    auth.validateToken.mockResolvedValue({
      isValid: true,
      data: { userId: randomUUID(), appId: base.appId },
    });
    await expect(service.cancel(base)).rejects.toBeInstanceOf(RpcException);
    auth.validateToken.mockResolvedValue({
      isValid: true,
      data: { userId: ACCOUNT_ID, appId: 'other' },
    });
    await expect(service.cancel(base)).rejects.toBeInstanceOf(RpcException);
    auth.validateToken.mockResolvedValue({
      isValid: true,
      data: { userId: ACCOUNT_ID, appId: 'business-site' },
    });
    await expect(
      service.cancel({ ...base, appId: 'business-site' })
    ).rejects.toBeInstanceOf(RpcException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('scopes the locked cancellation lookup by exact job, account, app, and kind', async () => {
    auth.validateToken.mockResolvedValue({
      isValid: true,
      data: { userId: ACCOUNT_ID, appId: 'client-interface' },
    });
    const query = { setLock: jest.fn(), where: jest.fn(), getOne: jest.fn() };
    query.setLock.mockReturnValue(query);
    query.where.mockReturnValue(query);
    query.getOne.mockResolvedValue(null);
    const repository = { createQueryBuilder: jest.fn(() => query) };
    dataSource.transaction.mockImplementation(async (callback) =>
      callback({ getRepository: () => repository })
    );
    await expect(
      service.cancel({
        accountId: ACCOUNT_ID,
        token: TOKEN,
        appId: 'client-interface',
        jobId: randomUUID(),
      })
    ).rejects.toMatchObject({
      error: expect.objectContaining({
        statusCode: 404,
        code: 'EXPORT_JOB_NOT_FOUND',
      }),
    });
    expect(query.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(query.where).toHaveBeenCalledWith(
      expect.stringContaining(
        'job.id = :id AND job.accountId = :accountId AND job.appId = :appId AND job.kind = :kind'
      ),
      expect.objectContaining({
        accountId: ACCOUNT_ID,
        appId: 'client-interface',
        kind: 'export',
      })
    );
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
    assetsCapture: jest.Mock;
    assetsCleanup: jest.Mock;
    videosCapture: jest.Mock;
    videosCleanup: jest.Mock;
    permissionsCapture: jest.Mock;
    permissionsCleanup: jest.Mock;
    socialCapture: jest.Mock;
    socialCleanup: jest.Mock;
    forumCapture: jest.Mock;
    forumCleanup: jest.Mock;
    workspaceCapture: jest.Mock;
    workspaceCleanup: jest.Mock;
    appConfiguratorCapture: jest.Mock;
    appConfiguratorCleanup: jest.Mock;
    chatCapture: jest.Mock;
    chatCleanup: jest.Mock;
    classifiedsCapture: jest.Mock;
    classifiedsCleanup: jest.Mock;
    paymentsCapture: jest.Mock;
    paymentsCleanup: jest.Mock;
  } {
    const captureMetadata = (participantId: string) => {
      const sources = ACCOUNT_EXPORT_RELEASE_SOURCE_REGISTRY[participantId];
      return {
        participantId,
        accountId: ACCOUNT_ID,
        captureId: randomUUID(),
        snapshotAt: '2026-10-19T16:00:00.000Z',
        sizeBytes: 0,
        sha256: '0'.repeat(64),
        rowCount: 0,
        sourceRowCounts: Object.fromEntries(
          sources.map((source) => [source, 0])
        ),
        sourceDispositions: Object.fromEntries(
          sources.map((source) => [source, 'none-retained'])
        ),
      };
    };
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
    const assetsResult = {
      handle: { metadata: captureMetadata('assets') },
      cleanup: jest.fn(async () => undefined),
    };
    const assetsCapture = { capture: jest.fn(async () => assetsResult) };
    const videosResult = {
      handle: { metadata: captureMetadata('videos') },
      cleanup: jest.fn(async () => undefined),
    };
    const videosCapture = {
      capture: jest.fn(async () => {
        expect(profileResult.cleanup).not.toHaveBeenCalled();
        expect(assetsResult.cleanup).not.toHaveBeenCalled();
        return videosResult;
      }),
    };
    const permissionsResult = {
      handle: { metadata: captureMetadata('permissions') },
      cleanup: jest.fn(async () => undefined),
    };
    const permissionsCapture = {
      capture: jest.fn(
        async (
          _grant: unknown,
          _profile: unknown,
          renew: () => Promise<boolean>
        ) => {
          expect(profileResult.cleanup).not.toHaveBeenCalled();
          expect(assetsResult.cleanup).not.toHaveBeenCalled();
          expect(videosResult.cleanup).not.toHaveBeenCalled();
          await renew();
          return permissionsResult;
        }
      ),
    };
    const socialResult = {
      handle: { metadata: captureMetadata('social') },
      cleanup: jest.fn(async () => undefined),
    };
    const socialCapture = {
      capture: jest.fn(
        async (
          _grant: unknown,
          profile: unknown,
          renew: () => Promise<boolean>
        ) => {
          expect(profile).toEqual({ handleId: 'profile-fixture' });
          expect(profileResult.cleanup).not.toHaveBeenCalled();
          expect(assetsResult.cleanup).not.toHaveBeenCalled();
          expect(videosResult.cleanup).not.toHaveBeenCalled();
          expect(permissionsResult.cleanup).not.toHaveBeenCalled();
          await renew();
          return socialResult;
        }
      ),
    };
    const forumResult = {
      handle: { metadata: captureMetadata('forum') },
      cleanup: jest.fn(async () => undefined),
    };
    const forumCapture = {
      capture: jest.fn(
        async (
          _grant: unknown,
          profile: unknown,
          renew: () => Promise<boolean>
        ) => {
          expect(profile).toEqual({ handleId: 'profile-fixture' });
          expect(socialResult.cleanup).not.toHaveBeenCalled();
          await renew();
          return forumResult;
        }
      ),
    };
    const workspaceResult = {
      handle: { metadata: captureMetadata('workspace') },
      cleanup: jest.fn(async () => undefined),
    };
    const workspaceCapture = {
      capture: jest.fn(
        async (
          _grant: unknown,
          profile: unknown,
          renew: () => Promise<boolean>
        ) => {
          expect(profile).toEqual({ handleId: 'profile-fixture' });
          expect(forumResult.cleanup).not.toHaveBeenCalled();
          await renew();
          return workspaceResult;
        }
      ),
    };
    const appConfiguratorResult = {
      handle: { metadata: captureMetadata('app-configurator') },
      cleanup: jest.fn(async () => undefined),
    };
    const appConfiguratorCapture = {
      capture: jest.fn(async () => appConfiguratorResult),
    };
    const classifiedsResult = {
      handle: { metadata: captureMetadata('classifieds') },
      cleanup: jest.fn(async () => undefined),
    };
    const classifiedsCapture = {
      capture: jest.fn(async () => classifiedsResult),
    };
    const chatResult = {
      handle: { metadata: captureMetadata('chat-collector') },
      cleanup: jest.fn(async () => undefined),
    };
    const chatCapture = { capture: jest.fn(async () => chatResult) };
    const paymentsResult = {
      handle: { metadata: captureMetadata('payments') },
      cleanup: jest.fn(async () => undefined),
    };
    const paymentsCapture = { capture: jest.fn(async () => paymentsResult) };
    const profileResult = {
      handle: { metadata: captureMetadata('profile') },
      descriptor: { handleId: 'profile-fixture' },
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
      profileCapture as never,
      assetsCapture as never,
      videosCapture as never,
      permissionsCapture as never,
      socialCapture as never,
      forumCapture as never,
      workspaceCapture as never,
      appConfiguratorCapture as never,
      chatCapture as never,
      classifiedsCapture as never,
      paymentsCapture as never
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
      assetsCapture: assetsCapture.capture,
      assetsCleanup: assetsResult.cleanup,
      videosCapture: videosCapture.capture,
      videosCleanup: videosResult.cleanup,
      permissionsCapture: permissionsCapture.capture,
      permissionsCleanup: permissionsResult.cleanup,
      socialCapture: socialCapture.capture,
      socialCleanup: socialResult.cleanup,
      forumCapture: forumCapture.capture,
      forumCleanup: forumResult.cleanup,
      workspaceCapture: workspaceCapture.capture,
      workspaceCleanup: workspaceResult.cleanup,
      appConfiguratorCapture: appConfiguratorCapture.capture,
      appConfiguratorCleanup: appConfiguratorResult.cleanup,
      chatCapture: chatCapture.capture,
      chatCleanup: chatResult.cleanup,
      classifiedsCapture: classifiedsCapture.capture,
      classifiedsCleanup: classifiedsResult.cleanup,
      paymentsCapture: paymentsCapture.capture,
      paymentsCleanup: paymentsResult.cleanup,
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

  it('stores twelve verified owner markers without publishing an export artifact', async () => {
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
    expect(result.coverageSummary.captureCoverage).toMatchObject({
      complete: true,
      blockers: [],
    });
    expect(result.artifactUrl).toBeNull();
    expect(result.coverageSummary).toMatchObject({
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
      artifactAvailable: false,
      captureCoverage: {
        complete: true,
        blockers: [],
      },
      blockers: expect.arrayContaining(['portable-media-unverified']),
    });
    expect(test.renewLease).toHaveBeenCalledTimes(
      1 + AUTHENTICATION_ACCOUNT_EXPORT_SOURCES.length + 5
    );
    expect(test.permissionsCapture).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: ACCOUNT_ID }),
      expect.objectContaining({ handleId: 'profile-fixture' }),
      expect.any(Function)
    );
    expect(test.socialCapture).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: ACCOUNT_ID }),
      expect.objectContaining({ handleId: 'profile-fixture' }),
      expect.any(Function)
    );
    expect(test.forumCapture).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: ACCOUNT_ID }),
      expect.objectContaining({ handleId: 'profile-fixture' }),
      expect.any(Function)
    );
    expect(test.workspaceCapture).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: ACCOUNT_ID }),
      expect.objectContaining({ handleId: 'profile-fixture' }),
      expect.any(Function)
    );
    expect(test.appConfiguratorCapture).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: ACCOUNT_ID }),
      expect.objectContaining({ handleId: 'profile-fixture' }),
      expect.any(Function)
    );
    expect(test.chatCapture).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: ACCOUNT_ID }),
      expect.objectContaining({ handleId: 'profile-fixture' }),
      expect.any(Function)
    );
    expect(test.chatCleanup.mock.invocationCallOrder[0]).toBeLessThan(
      test.appConfiguratorCleanup.mock.invocationCallOrder[0]
    );
    expect(test.workspaceCleanup.mock.invocationCallOrder[0]).toBeLessThan(
      test.forumCleanup.mock.invocationCallOrder[0]
    );
    expect(
      test.appConfiguratorCleanup.mock.invocationCallOrder[0]
    ).toBeLessThan(test.workspaceCleanup.mock.invocationCallOrder[0]);
    expect(test.forumCleanup.mock.invocationCallOrder[0]).toBeLessThan(
      test.socialCleanup.mock.invocationCallOrder[0]
    );
    expect(test.socialCleanup.mock.invocationCallOrder[0]).toBeLessThan(
      test.permissionsCleanup.mock.invocationCallOrder[0]
    );
    expect(test.permissionsCleanup.mock.invocationCallOrder[0]).toBeLessThan(
      test.videosCleanup.mock.invocationCallOrder[0]
    );
    expect(JSON.stringify(result)).not.toContain('PRIVATE-OWNER-DATA-CANARY');
    expect(JSON.stringify(result)).not.toMatch(
      /sha256|captureId|sizeBytes|stage/i
    );
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });

  it.each(['capture', 'cleanup', 'lease'])(
    'fails safely when Social %s fails and cleans snapshots in reverse order',
    async (mode) => {
      const owner = jest.fn(async ({ onChunk }) => {
        const chunks = createOwnerChunks(ACCOUNT_ID);
        for (const chunk of chunks) await onChunk(chunk);
        return chunks[chunks.length - 1];
      });
      const test = harness(async () => true, owner);
      if (mode === 'capture')
        test.socialCapture.mockRejectedValueOnce(
          new Error('private Social diagnostic')
        );
      if (mode === 'cleanup')
        test.socialCleanup.mockRejectedValueOnce(
          new Error('private Social cleanup detail')
        );
      if (mode === 'lease') {
        test.socialCapture.mockImplementationOnce(async (_g, _p, renew) => {
          test.renewLease.mockResolvedValueOnce(false);
          await renew();
          throw new Error('stale lease');
        });
        await expect(test.run(input(), activeClaim)).rejects.toMatchObject({
          message: 'Export operation lease is no longer current',
        });
        expect(test.finish).not.toHaveBeenCalled();
      } else {
        const result = await test.run(input(), activeClaim);
        expect(result.state).toBe('failed');
        expect(result.coverageSummary.capturedDatabaseOwners).toEqual([
          'authentication',
          'profile',
          'assets',
          'videos',
          'permissions',
        ]);
        expect(result.coverageSummary.blockers).toContain(
          'social-capture-unavailable'
        );
        expect(JSON.stringify(result)).not.toContain('private Social');
        expect(JSON.stringify(result)).not.toContain(TOKEN);
      }
      if (mode === 'cleanup')
        expect(test.socialCleanup.mock.invocationCallOrder[0]).toBeLessThan(
          test.permissionsCleanup.mock.invocationCallOrder[0]
        );
      expect(test.permissionsCleanup.mock.invocationCallOrder[0]).toBeLessThan(
        test.videosCleanup.mock.invocationCallOrder[0]
      );
      expect(test.videosCleanup.mock.invocationCallOrder[0]).toBeLessThan(
        test.assetsCleanup.mock.invocationCallOrder[0]
      );
      expect(test.assetsCleanup.mock.invocationCallOrder[0]).toBeLessThan(
        test.profileCleanup.mock.invocationCallOrder[0]
      );
      expect(await readdir(root)).toEqual([]);
    }
  );

  it('retries a failed Social stage without retaining the previous attempt spool', async () => {
    const owner = jest.fn(async ({ onChunk }) => {
      const chunks = createOwnerChunks(ACCOUNT_ID);
      for (const chunk of chunks) await onChunk(chunk);
      return chunks[chunks.length - 1];
    });
    const test = harness(async () => true, owner);
    test.socialCapture.mockRejectedValueOnce(
      new Error('private Social temporary failure')
    );
    const first = await test.run(input(), activeClaim);
    expect(first.state).toBe('failed');
    expect(first.coverageSummary.blockers).toContain(
      'social-capture-unavailable'
    );
    expect(await readdir(root)).toEqual([]);

    for (const cleanup of [
      test.profileCleanup,
      test.assetsCleanup,
      test.videosCleanup,
      test.permissionsCleanup,
      test.socialCleanup,
    ])
      cleanup.mockClear();

    activeClaim.state = 'running';
    activeClaim.attempt += 1;
    activeClaim.leaseOwner = randomUUID();
    activeClaim.leaseExpiresAt = new Date(Date.now() + 60_000);
    const second = await test.run(input(), activeClaim);
    expect(second.state).toBe('incomplete');
    expect(second.coverageSummary.captureCoverage).toMatchObject({
      complete: true,
      blockers: [],
    });
    expect(second.coverageSummary.capturedDatabaseOwners).toContain('social');
    expect(test.socialCapture).toHaveBeenCalledTimes(2);
    expect(await readdir(root)).toEqual([]);
  });

  it.each(['capture', 'cleanup'])(
    'keeps the six-owner prefix when Forum %s fails and restores nine on retry',
    async (mode) => {
      const owner = jest.fn(async ({ onChunk }) => {
        const chunks = createOwnerChunks(ACCOUNT_ID);
        for (const chunk of chunks) await onChunk(chunk);
        return chunks[chunks.length - 1];
      });
      const test = harness(async () => true, owner);
      if (mode === 'capture')
        test.forumCapture.mockRejectedValueOnce(
          new Error('private Forum diagnostic')
        );
      else
        test.forumCleanup.mockRejectedValueOnce(
          new Error('private Forum cleanup diagnostic')
        );

      const first = await test.run(input(), activeClaim);
      expect(first.state).toBe('failed');
      expect(first.coverageSummary.blockers).toContain(
        'forum-capture-unavailable'
      );
      expect(first.coverageSummary.capturedDatabaseOwners).toEqual([
        'authentication',
        'profile',
        'assets',
        'videos',
        'permissions',
        'social',
      ]);
      expect(first.coverageSummary.artifactAvailable).toBe(false);
      expect(first.artifactUrl).toBeNull();
      expect(JSON.stringify(first)).not.toContain('private Forum');
      expect(await readdir(root)).toEqual([]);

      for (const cleanup of [
        test.profileCleanup,
        test.assetsCleanup,
        test.videosCleanup,
        test.permissionsCleanup,
        test.socialCleanup,
        test.forumCleanup,
        test.workspaceCleanup,
        test.appConfiguratorCleanup,
        test.chatCleanup,
        test.classifiedsCleanup,
      ])
        cleanup.mockClear();
      activeClaim.state = 'running';
      activeClaim.attempt += 1;
      activeClaim.leaseOwner = randomUUID();
      activeClaim.leaseExpiresAt = new Date(Date.now() + 60_000);
      const second = await test.run(input(), activeClaim);
      expect(second.state).toBe('incomplete');
      expect(second.coverageSummary.captureCoverage).toMatchObject({
        complete: true,
        blockers: [],
      });
      expect(second.coverageSummary.capturedDatabaseOwners).toEqual([
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
      ]);
      expect(second.coverageSummary.artifactAvailable).toBe(false);
      expect(second.artifactUrl).toBeNull();
      expect(test.forumCapture).toHaveBeenCalledTimes(2);
      expect(test.forumCleanup.mock.invocationCallOrder[0]).toBeLessThan(
        test.socialCleanup.mock.invocationCallOrder[0]
      );
      expect(await readdir(root)).toEqual([]);
    }
  );

  it.each(['capture', 'cleanup'])(
    'keeps nine owners when Chat %s fails',
    async (mode) => {
      const owner = jest.fn(async ({ onChunk }) => {
        const chunks = createOwnerChunks(ACCOUNT_ID);
        for (const chunk of chunks) await onChunk(chunk);
        return chunks[chunks.length - 1];
      });
      const test = harness(async () => true, owner);
      (mode === 'capture'
        ? test.chatCapture
        : test.chatCleanup
      ).mockRejectedValueOnce(new Error('private chat payload'));
      const result = await test.run(input(), activeClaim);
      expect(result.state).toBe('failed');
      expect(result.coverageSummary.capturedDatabaseOwners).toEqual([
        'authentication',
        'profile',
        'assets',
        'videos',
        'permissions',
        'social',
        'forum',
        'workspace',
        'app-configurator',
      ]);
      expect(result.coverageSummary.blockers).toContain(
        'chat-collector-capture-unavailable'
      );
      expect(result.artifactUrl).toBeNull();
      expect(result.coverageSummary.artifactAvailable).toBe(false);
      expect(JSON.stringify(result)).not.toContain('private chat payload');
      expect(test.appConfiguratorCleanup).toHaveBeenCalledTimes(1);
      if (mode === 'cleanup')
        expect(test.chatCleanup.mock.invocationCallOrder[0]).toBeLessThan(
          test.appConfiguratorCleanup.mock.invocationCallOrder[0]
        );
      expect(await readdir(root)).toEqual([]);
    }
  );

  it.each(['capture', 'cleanup'])(
    'keeps eleven owners when Payments %s fails',
    async (mode) => {
      const owner = jest.fn(async ({ onChunk }) => {
        const chunks = createOwnerChunks(ACCOUNT_ID);
        for (const chunk of chunks) await onChunk(chunk);
        return chunks[chunks.length - 1];
      });
      const test = harness(async () => true, owner);
      (mode === 'capture'
        ? test.paymentsCapture
        : test.paymentsCleanup
      ).mockRejectedValueOnce(new Error('private payments payload'));
      const result = await test.run(input(), activeClaim);
      expect(result.state).toBe('failed');
      expect(result.coverageSummary.capturedDatabaseOwners).toEqual([
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
      ]);
      expect(result.coverageSummary.blockers).toContain(
        'payments-capture-unavailable'
      );
      expect(result.artifactUrl).toBeNull();
      expect(result.coverageSummary.artifactAvailable).toBe(false);
      expect(JSON.stringify(result)).not.toContain('private payments payload');
      expect(test.classifiedsCleanup).toHaveBeenCalledTimes(1);
      if (mode === 'cleanup')
        expect(test.paymentsCleanup.mock.invocationCallOrder[0]).toBeLessThan(
          test.classifiedsCleanup.mock.invocationCallOrder[0]
        );
      expect(await readdir(root)).toEqual([]);
    }
  );

  it('does not finish a Payments capture whose job lease was lost', async () => {
    const owner = jest.fn(async ({ onChunk }) => {
      const chunks = createOwnerChunks(ACCOUNT_ID);
      for (const chunk of chunks) await onChunk(chunk);
      return chunks[chunks.length - 1];
    });
    const test = harness(async () => true, owner);
    test.paymentsCapture.mockImplementationOnce(
      async (_grant, _profile, renew) => {
        test.renewLease.mockResolvedValueOnce(false);
        await renew();
        throw new Error('stale Payments response');
      }
    );
    await expect(test.run(input(), activeClaim)).rejects.toMatchObject({
      message: 'Export operation lease is no longer current',
    });
    expect(test.finish).not.toHaveBeenCalled();
    expect(test.classifiedsCleanup).toHaveBeenCalledTimes(1);
    expect(await readdir(root)).toEqual([]);
  });

  it.each(['capture', 'cleanup'])(
    'keeps ten owners when Classifieds %s fails',
    async (mode) => {
      const owner = jest.fn(async ({ onChunk }) => {
        const chunks = createOwnerChunks(ACCOUNT_ID);
        for (const chunk of chunks) await onChunk(chunk);
        return chunks[chunks.length - 1];
      });
      const test = harness(async () => true, owner);
      (mode === 'capture'
        ? test.classifiedsCapture
        : test.classifiedsCleanup
      ).mockRejectedValueOnce(new Error('private classifieds payload'));
      const result = await test.run(input(), activeClaim);
      expect(result.state).toBe('failed');
      expect(result.coverageSummary.capturedDatabaseOwners).toEqual([
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
      ]);
      expect(result.coverageSummary.blockers).toContain(
        'classifieds-capture-unavailable'
      );
      expect(result.artifactUrl).toBeNull();
      expect(result.coverageSummary.artifactAvailable).toBe(false);
      expect(JSON.stringify(result)).not.toContain(
        'private classifieds payload'
      );
      expect(test.chatCleanup).toHaveBeenCalledTimes(1);
      if (mode === 'cleanup')
        expect(
          test.classifiedsCleanup.mock.invocationCallOrder[0]
        ).toBeLessThan(test.chatCleanup.mock.invocationCallOrder[0]);
      expect(await readdir(root)).toEqual([]);
    }
  );

  it.each(['capture', 'cleanup'])(
    'keeps exactly eight earlier owners when App Configurator %s fails',
    async (mode) => {
      const owner = jest.fn(async ({ onChunk }) => {
        const chunks = createOwnerChunks(ACCOUNT_ID);
        for (const chunk of chunks) await onChunk(chunk);
        return chunks[chunks.length - 1];
      });
      const test = harness(async () => true, owner);
      if (mode === 'capture')
        test.appConfiguratorCapture.mockRejectedValueOnce(
          new Error('private app configuration capture')
        );
      else
        test.appConfiguratorCleanup.mockRejectedValueOnce(
          new Error('private app configuration cleanup')
        );
      const result = await test.run(input(), activeClaim);
      expect(result.state).toBe('failed');
      expect(result.coverageSummary.capturedDatabaseOwners).toEqual([
        'authentication',
        'profile',
        'assets',
        'videos',
        'permissions',
        'social',
        'forum',
        'workspace',
      ]);
      expect(result.coverageSummary.blockers).toContain(
        'app-configurator-capture-unavailable'
      );
      expect(result.artifactUrl).toBeNull();
      expect(result.coverageSummary.artifactAvailable).toBe(false);
      expect(JSON.stringify(result)).not.toContain('private app configuration');
      if (mode === 'cleanup')
        expect(
          test.appConfiguratorCleanup.mock.invocationCallOrder[0]
        ).toBeLessThan(test.workspaceCleanup.mock.invocationCallOrder[0]);
      expect(test.profileCleanup).toHaveBeenCalledTimes(1);
      expect(await readdir(root)).toEqual([]);
    }
  );

  it.each(['capture', 'cleanup'])(
    'keeps the seven-owner prefix when Workspace %s fails and restores nine on retry',
    async (mode) => {
      const owner = jest.fn(async ({ onChunk }) => {
        const chunks = createOwnerChunks(ACCOUNT_ID);
        for (const chunk of chunks) await onChunk(chunk);
        return chunks[chunks.length - 1];
      });
      const test = harness(async () => true, owner);
      if (mode === 'capture')
        test.workspaceCapture.mockRejectedValueOnce(
          new Error('private Workspace diagnostic')
        );
      else
        test.workspaceCleanup.mockRejectedValueOnce(
          new Error('private Workspace cleanup diagnostic')
        );

      const first = await test.run(input(), activeClaim);
      expect(first.state).toBe('failed');
      expect(first.coverageSummary.blockers).toContain(
        'workspace-capture-unavailable'
      );
      expect(first.coverageSummary.capturedDatabaseOwners).toEqual(
        mode === 'capture'
          ? [
              'authentication',
              'profile',
              'assets',
              'videos',
              'permissions',
              'social',
              'forum',
            ]
          : [
              'authentication',
              'profile',
              'assets',
              'videos',
              'permissions',
              'social',
              'forum',
            ]
      );
      expect(first.coverageSummary.artifactAvailable).toBe(false);
      expect(first.artifactUrl).toBeNull();
      expect(JSON.stringify(first)).not.toContain('private Workspace');
      expect(await readdir(root)).toEqual([]);

      for (const cleanup of [
        test.profileCleanup,
        test.assetsCleanup,
        test.videosCleanup,
        test.permissionsCleanup,
        test.socialCleanup,
        test.forumCleanup,
        test.workspaceCleanup,
        test.appConfiguratorCleanup,
        test.chatCleanup,
        test.classifiedsCleanup,
      ])
        cleanup.mockClear();
      activeClaim.state = 'running';
      activeClaim.attempt += 1;
      activeClaim.leaseOwner = randomUUID();
      activeClaim.leaseExpiresAt = new Date(Date.now() + 60_000);
      const second = await test.run(input(), activeClaim);
      expect(second.state).toBe('incomplete');
      expect(second.coverageSummary.captureCoverage).toMatchObject({
        complete: true,
        blockers: [],
      });
      expect(second.coverageSummary.capturedDatabaseOwners).toEqual([
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
      ]);
      expect(second.coverageSummary.artifactAvailable).toBe(false);
      expect(second.artifactUrl).toBeNull();
      expect(test.workspaceCapture).toHaveBeenCalledTimes(2);
      expect(test.workspaceCleanup.mock.invocationCallOrder[0]).toBeLessThan(
        test.forumCleanup.mock.invocationCallOrder[0]
      );
      expect(await readdir(root)).toEqual([]);
    }
  );

  it('retains prior cleanup blockers while later cleanup failures restore their trusted prefix', async () => {
    const owner = jest.fn(async ({ onChunk }) => {
      const chunks = createOwnerChunks(ACCOUNT_ID);
      for (const chunk of chunks) await onChunk(chunk);
      return chunks[chunks.length - 1];
    });
    const test = harness(async () => true, owner);
    test.workspaceCleanup.mockRejectedValueOnce(
      new Error('private Workspace cleanup')
    );
    test.forumCleanup.mockRejectedValueOnce(new Error('private Forum cleanup'));
    test.appConfiguratorCleanup.mockRejectedValueOnce(
      new Error('private App Configurator cleanup')
    );
    const result = await test.run(input(), activeClaim);
    expect(result.state).toBe('failed');
    expect(result.coverageSummary.capturedDatabaseOwners).toEqual([
      'authentication',
      'profile',
      'assets',
      'videos',
      'permissions',
      'social',
    ]);
    expect(result.coverageSummary.blockers).toEqual(
      expect.arrayContaining([
        'workspace-capture-unavailable',
        'forum-capture-unavailable',
        'app-configurator-capture-unavailable',
      ])
    );
    expect(test.workspaceCleanup.mock.invocationCallOrder[0]).toBeLessThan(
      test.forumCleanup.mock.invocationCallOrder[0]
    );
    expect(test.profileCleanup).toHaveBeenCalledTimes(1);
    expect(await readdir(root)).toEqual([]);
  });

  it.each(['capture', 'cleanup', 'lease'])(
    'fails safely when Permissions %s fails and cleans children in reverse order',
    async (mode) => {
      const owner = jest.fn(async ({ onChunk }) => {
        const chunks = createOwnerChunks(ACCOUNT_ID);
        for (const c of chunks) await onChunk(c);
        return chunks[chunks.length - 1];
      });
      const test = harness(async () => true, owner);
      if (mode === 'capture')
        test.permissionsCapture.mockRejectedValueOnce(
          new Error('private Permissions diagnostic')
        );
      if (mode === 'cleanup')
        test.permissionsCleanup.mockRejectedValueOnce(
          new Error('private Permissions cleanup')
        );
      if (mode === 'lease') {
        test.permissionsCapture.mockImplementationOnce(
          async (_g, _p, renew) => {
            test.renewLease.mockResolvedValueOnce(false);
            await renew();
            throw Error('stale lease');
          }
        );
        await expect(test.run(input(), activeClaim)).rejects.toMatchObject({
          message: 'Export operation lease is no longer current',
        });
        expect(test.finish).not.toHaveBeenCalled();
      } else {
        const result = await test.run(input(), activeClaim);
        expect(result.state).toBe('failed');
        expect(result.coverageSummary.capturedDatabaseOwners).toEqual([
          'authentication',
          'profile',
          'assets',
          'videos',
        ]);
        expect(result.coverageSummary.blockers).toContain(
          'permissions-capture-unavailable'
        );
        expect(JSON.stringify(result)).not.toContain('private Permissions');
      }
      expect(test.videosCleanup.mock.invocationCallOrder[0]).toBeLessThan(
        test.assetsCleanup.mock.invocationCallOrder[0]
      );
      expect(test.assetsCleanup.mock.invocationCallOrder[0]).toBeLessThan(
        test.profileCleanup.mock.invocationCallOrder[0]
      );
      if (mode === 'cleanup')
        expect(
          test.permissionsCleanup.mock.invocationCallOrder[0]
        ).toBeLessThan(test.videosCleanup.mock.invocationCallOrder[0]);
    }
  );

  it.each(['capture', 'cleanup', 'lease'])(
    'fails safely when Videos %s fails and closes children before Profile',
    async (mode) => {
      const owner = jest.fn(async ({ onChunk }) => {
        const chunks = createOwnerChunks(ACCOUNT_ID);
        for (const c of chunks) await onChunk(c);
        return chunks[chunks.length - 1];
      });
      const test = harness(async () => true, owner);
      if (mode === 'capture')
        test.videosCapture.mockRejectedValueOnce(
          new Error('private Videos diagnostic')
        );
      if (mode === 'cleanup')
        test.videosCleanup.mockRejectedValueOnce(
          new Error('private Videos cleanup')
        );
      if (mode === 'lease') {
        test.videosCapture.mockImplementationOnce(async (_g, _p, renew) => {
          test.renewLease.mockResolvedValueOnce(false);
          await renew();
          throw Error('stale');
        });
        await expect(test.run(input(), activeClaim)).rejects.toMatchObject({
          message: 'Export operation lease is no longer current',
        });
        expect(test.finish).not.toHaveBeenCalled();
      } else {
        const result = await test.run(input(), activeClaim);
        expect(result.state).toBe('failed');
        expect(result.coverageSummary.capturedDatabaseOwners).toEqual([
          'authentication',
          'profile',
          'assets',
        ]);
        expect(result.coverageSummary.blockers).toContain(
          'videos-capture-unavailable'
        );
        expect(JSON.stringify(result)).not.toContain('private Videos');
      }
      expect(test.assetsCleanup).toHaveBeenCalledTimes(1);
      expect(test.profileCleanup).toHaveBeenCalledTimes(1);
      expect(test.assetsCleanup.mock.invocationCallOrder[0]).toBeLessThan(
        test.profileCleanup.mock.invocationCallOrder[0]
      );
      if (mode === 'cleanup')
        expect(test.videosCleanup.mock.invocationCallOrder[0]).toBeLessThan(
          test.assetsCleanup.mock.invocationCallOrder[0]
        );
    }
  );

  it.each(['capture', 'cleanup', 'lease'])(
    'fails safely when Assets %s fails while keeping Profile alive until cleanup',
    async (mode) => {
      const owner = jest.fn(async ({ onChunk }) => {
        const chunks = createOwnerChunks(ACCOUNT_ID);
        for (const chunk of chunks) await onChunk(chunk);
        return chunks[chunks.length - 1];
      });
      const test = harness(async () => true, owner);
      if (mode === 'capture')
        test.assetsCapture.mockRejectedValueOnce(
          new Error('private Assets diagnostic')
        );
      if (mode === 'cleanup')
        test.assetsCleanup.mockRejectedValueOnce(
          new Error('private Assets cleanup')
        );
      if (mode === 'lease') {
        test.assetsCapture.mockImplementationOnce(
          async (_grant, _profile, renew) => {
            test.renewLease.mockResolvedValueOnce(false);
            await renew();
            throw new Error('stale');
          }
        );
        await expect(test.run(input(), activeClaim)).rejects.toMatchObject({
          message: 'Export operation lease is no longer current',
        });
        expect(test.finish).not.toHaveBeenCalled();
      } else {
        const result = await test.run(input(), activeClaim);
        expect(result.state).toBe('failed');
        expect(result.coverageSummary.capturedDatabaseOwners).toEqual([
          'authentication',
          'profile',
        ]);
        expect(result.coverageSummary.blockers).toContain(
          'assets-capture-unavailable'
        );
        expect(JSON.stringify(result)).not.toContain('private Assets');
      }
      expect(test.profileCleanup).toHaveBeenCalledTimes(1);
      if (mode === 'cleanup')
        expect(test.assetsCleanup.mock.invocationCallOrder[0]).toBeLessThan(
          test.profileCleanup.mock.invocationCallOrder[0]
        );
    }
  );

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
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
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
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
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

    const cancel = (row: AccountExportJobEntity) =>
      (
        service as unknown as {
          cancel(request: unknown): Promise<AccountExportJobStatus>;
        }
      ).cancel({
        accountId: row.accountId,
        token: TOKEN,
        appId: row.appId,
        jobId: row.id,
      });
    const authSessionForCancel = (accountId: string) => {
      (
        service as unknown as { auth: { validateToken: jest.Mock } }
      ).auth.validateToken = jest.fn().mockResolvedValue({
        isValid: true,
        data: { userId: accountId, appId: 'client-interface' },
      });
    };

    it('cancellation invalidates a running lease and the stale worker cannot finish it', async () => {
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
          leaseExpiresAt: new Date(Date.now() + 60_000),
          coverageVersion: '2026-10-17.v1',
          coverageSummary: {
            blockers: ['owner-gap'],
            coveredOwners: ['authentication'],
            artifactAvailable: true,
          },
        })
      );
      authSessionForCancel(row.accountId);
      const result = await cancel(row);
      expect(result.state).toBe('failed');
      expect(JSON.stringify(result)).not.toContain(TOKEN);
      const cancelled = await repository.findOneByOrFail({ id });
      expect(cancelled).toMatchObject({
        state: 'failed',
        attempt: 3,
        lastErrorCode: 'EXPORT_JOB_CANCELLED',
        leaseOwner: null,
        leaseExpiresAt: null,
        completedAt: null,
        coverageSummary: {
          blockers: ['owner-gap', 'cancelled'],
          coveredOwners: ['authentication'],
          globalCompletionBlocked: true,
          artifactAvailable: false,
        },
      });
      await finish(row);
      expect(await repository.findOneByOrFail({ id })).toEqual(cancelled);

      const resumed = await (
        service as unknown as {
          claim(id: string): Promise<AccountExportJobEntity | null>;
        }
      ).claim(id);
      expect(resumed).toMatchObject({ state: 'running', attempt: 4 });
    });

    it('does not rewrite completed jobs during cancellation', async () => {
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
          state: 'complete',
          attempt: 2,
          coverageVersion: '2026-10-17.v1',
          completedAt: new Date(),
          coverageSummary: { blockers: [], artifactAvailable: true },
        })
      );
      authSessionForCancel(row.accountId);
      await cancel(row);
      expect(await repository.findOneByOrFail({ id })).toEqual(row);
    });

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
