import { randomUUID } from 'node:crypto';
import { VideosAccountDeletionOwnerService } from './account-deletion-owner.service';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));

describe('Videos deletion owner authority and attribution', () => {
  const account = randomUUID(),
    profile = randomUUID(),
    channel = randomUUID(),
    video = randomUUID(),
    operation = randomUUID();
  const scope = { currentProfileIds: [profile], legacyProfileIds: [] };
  const grant = {
    contractVersion: 1,
    operationId: operation,
    accountId: account,
    appId: 'local-hub',
    owner: 'videos',
    action: 'fence',
    attempt: 1,
    leaseOwner: randomUUID(),
    expiresAt: new Date(Date.now() + 30000).toISOString(),
    signature: 'a'.repeat(64),
  };
  let service: VideosAccountDeletionOwnerService,
    authority: any,
    worker: any,
    processing: any,
    manager: any,
    channels: any[];
  beforeEach(() => {
    channels = [{ id: channel, userId: account, profileId: profile }];
    manager = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT "operationId"'))
          return [{ operationId: operation }];
        if (sql.startsWith('SELECT c.id')) return channels;
        if (sql.startsWith('SELECT v.id')) return [{ id: video }];
        return [];
      }),
    };
    authority = {
      validate: jest.fn().mockResolvedValue({ accountId: account, scope }),
    };
    worker = { fenceVideo: jest.fn().mockResolvedValue(undefined) };
    processing = {
      purgeDeletionStaging: jest.fn().mockResolvedValue(undefined),
    };
    service = new VideosAccountDeletionOwnerService(
      { transaction: (fn: any) => fn(manager) } as never,
      authority,
      worker,
      processing
    );
  });
  it('requires the signed literal Videos owner and action before inspecting data', async () => {
    await expect(
      service.execute({ ...grant, owner: 'assets' }, 'fence')
    ).rejects.toThrow('GRANT_INVALID');
    expect(authority.validate).not.toHaveBeenCalled();
    await expect(service.execute(grant, 'erase')).rejects.toThrow(
      'GRANT_INVALID'
    );
  });
  it('fences output before cleaning only attributed staging IDs', async () => {
    await expect(service.execute(grant, 'fence')).resolves.toEqual({
      verified: true,
    });
    expect(worker.fenceVideo).toHaveBeenCalledWith(video, operation);
    expect(processing.purgeDeletionStaging).toHaveBeenCalledWith([video]);
  });
  it('blocks mismatched account/profile channel ownership without purging media', async () => {
    channels[0].userId = randomUUID();
    await expect(service.execute(grant, 'fence')).rejects.toThrow(
      'BINDING_CONFLICT'
    );
    expect(worker.fenceVideo).not.toHaveBeenCalled();
  });
  it('retains a recoverable failure when the output worker cannot prove absence', async () => {
    worker.fenceVideo.mockRejectedValue(new Error('unavailable'));
    await expect(service.execute(grant, 'fence')).rejects.toThrow(
      'unavailable'
    );
    expect(processing.purgeDeletionStaging).not.toHaveBeenCalled();
  });
});
