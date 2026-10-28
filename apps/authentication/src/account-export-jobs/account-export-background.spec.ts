import { randomUUID } from 'node:crypto';
import { AccountExportJobService } from './account-export-job.service';

describe('A04 background job session and restart boundary', () => {
  const fixture = () => {
    const row = {
      id: randomUUID(),
      accountId: randomUUID(),
      appId: 'local-hub',
      idempotencyKey: randomUUID(),
      state: 'running',
      attempt: 1,
      leaseOwner: randomUUID(),
      coverageSummary: { privateSessionRef: randomUUID() },
      leaseExpiresAt: new Date(Date.now() + 60000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const query: any = {};
    for (const method of ['update', 'set', 'where', 'orderBy', 'take'])
      query[method] = jest.fn(() => query);
    query.execute = jest.fn(async () => ({ affected: 1 }));
    query.getMany = jest.fn(async () => [row]);
    const tokens = {
      findOneBy: jest.fn(async () => ({
        id: row.coverageSummary.privateSessionRef,
        userId: row.accountId,
        tokenData: 'memory-only-bearer',
      })),
    };
    // Exercise the actual scheduling/recovery methods without unrelated owner transports.
    const service: any = Object.create(AccountExportJobService.prototype);
    Object.assign(service, {
      jobs: { createQueryBuilder: jest.fn(() => query) },
      dataSource: { getRepository: jest.fn(() => tokens) },
      background: new Set(),
      deletedAccounts: new Set(),
      accountWork: new Map(),
      closing: false,
      activeLaunches: 0,
      recovering: false,
      authorize: jest.fn(async () => undefined),
      claim: jest.fn(async () => row),
      finish: jest.fn(async () => row),
      artifacts: { recover: jest.fn(async () => undefined) },
    });
    return { service, query, tokens, row };
  };

  it('returns running status while work remains pending and persists only an opaque token-row reference', async () => {
    const { service, query, row } = fixture();
    let complete!: () => void;
    const pending = new Promise<void>((resolve) => {
      complete = resolve;
    });
    service.claim = jest.fn(async () => row);
    service.run = jest.fn(() => pending);
    const result = await service.launch(
      {
        accountId: row.accountId,
        appId: row.appId,
        token: 'memory-only-bearer',
        idempotencyKey: row.idempotencyKey,
      },
      row
    );
    expect(result.state).toBe('running');
    expect(service.run).toHaveBeenCalledTimes(1);
    expect(service.background.size).toBe(1);
    expect(query.set).toHaveBeenCalledWith({
      coverageSummary: {
        privateSessionRef: row.coverageSummary.privateSessionRef,
      },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /privateSessionRef|memory-only-bearer/
    );
    complete();
    await Promise.all([...service.background]);
    expect(service.background.size).toBe(0);
    expect(service.activeLaunches).toBe(0);
  });

  it('bounds concurrent launches before taking another database claim', async () => {
    const { service, row } = fixture();
    service.activeLaunches = 2;
    await expect(
      service.launch(
        {
          accountId: row.accountId,
          appId: row.appId,
          token: 'memory-only-bearer',
          idempotencyKey: row.idempotencyKey,
        },
        row
      )
    ).rejects.toThrow();
    expect(service.claim).not.toHaveBeenCalled();
    expect(service.activeLaunches).toBe(2);
  });

  it('restart resolves the active account-bound token row and reauthorizes before launching', async () => {
    const { service, query, tokens, row } = fixture();
    service.launch = jest.fn(async () => undefined);
    await service.recoverBackground();
    expect(query.where).toHaveBeenCalledWith(
      expect.stringContaining('leaseExpiresAt'),
      expect.objectContaining({ apps: ['client-interface', 'local-hub'] })
    );
    expect(tokens.findOneBy).toHaveBeenCalledWith({
      id: row.coverageSummary.privateSessionRef,
      userId: row.accountId,
      revoked: false,
    });
    expect(service.authorize).toHaveBeenCalledWith(
      row.accountId,
      'memory-only-bearer',
      'local-hub'
    );
    expect(service.launch).toHaveBeenCalledTimes(1);
    expect(service.recovering).toBe(false);
  });

  it('a revoked session cannot resume and the failure update cannot overwrite a current live lease', async () => {
    const { service, query, tokens } = fixture();
    tokens.findOneBy.mockResolvedValue(null as never);
    service.launch = jest.fn();
    await service.recoverBackground();
    expect(service.launch).not.toHaveBeenCalled();
    expect(service.authorize).not.toHaveBeenCalled();
    expect(service.claim).toHaveBeenCalledTimes(1);
    expect(service.artifacts.recover).toHaveBeenCalledTimes(1);
    expect(service.finish).toHaveBeenCalledWith(
      expect.any(Object),
      'failed',
      expect.objectContaining({ artifactAvailable: false }),
      'export-session-unavailable'
    );
  });

  it('retries cleanup-pending custody without resolving any user token', async () => {
    const { service, tokens, row } = fixture();
    row.state = 'failed';
    Object.assign(row.coverageSummary, { artifactState: 'cleanup-pending' });
    service.artifacts.recover.mockRejectedValueOnce(
      new Error('storage temporarily unavailable')
    );
    await service.recoverBackground();
    expect(tokens.findOneBy).not.toHaveBeenCalled();
    expect(service.finish).toHaveBeenLastCalledWith(
      row,
      'failed',
      expect.objectContaining({ artifactState: 'cleanup-pending' }),
      'artifact-cleanup-unavailable'
    );
    await service.recoverBackground();
    expect(service.artifacts.recover).toHaveBeenCalledTimes(2);
    expect(service.finish).toHaveBeenLastCalledWith(
      row,
      'failed',
      expect.not.objectContaining({ artifactState: 'cleanup-pending' }),
      'export-session-unavailable'
    );
  });

  it('shutdown refuses new lease renewal or restart scans', async () => {
    const { service, query, row } = fixture();
    service.onModuleDestroy();
    expect(await service.renewLease(row)).toBe(false);
    await service.recoverBackground();
    expect(query.getMany).not.toHaveBeenCalled();
  });
});
