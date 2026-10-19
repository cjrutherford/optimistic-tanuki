import { RpcException } from '@nestjs/microservices';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
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
      preview as never
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
