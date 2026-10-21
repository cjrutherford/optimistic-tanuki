import { ProfileService } from './profile.service';
import { RpcException } from '@nestjs/microservices';

describe('ProfileService.resolveAccountBindings', () => {
  const profileId = 'a1111111-1111-4111-8111-111111111111';
  const accountId = 'b2222222-2222-4222-8222-222222222222';
  const qb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };
  const repo = { createQueryBuilder: jest.fn(() => qb) };
  const service = new ProfileService(
    repo as any,
    {} as any,
    {} as any,
    {} as any
  );

  beforeEach(() => jest.clearAllMocks());

  it('deduplicates canonical UUIDs and returns only valid owner bindings', async () => {
    qb.getMany.mockResolvedValue([
      { id: profileId.toUpperCase(), userId: accountId.toUpperCase() },
    ]);
    await expect(
      service.resolveAccountBindings({
        profileIds: [profileId.toUpperCase(), profileId],
      })
    ).resolves.toEqual({
      profileIds: [profileId],
      bindings: [{ profileId, accountId }],
    });
    expect(qb.select).toHaveBeenCalledWith(['profile.id', 'profile.userId']);
    expect(qb.limit).toHaveBeenCalledWith(100);
  });

  it('rejects malformed IDs before querying and returns no legacy-invalid owner', async () => {
    await expect(
      service.resolveAccountBindings({ profileIds: ['bad'] })
    ).rejects.toBeInstanceOf(RpcException);
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
    qb.getMany.mockResolvedValue([{ id: profileId, userId: 'legacy-owner' }]);
    await expect(
      service.resolveAccountBindings({ profileIds: [profileId] })
    ).resolves.toEqual({ profileIds: [profileId], bindings: [] });
  });

  it('returns an empty result without querying and rejects more than 100 raw IDs before deduplication', async () => {
    await expect(
      service.resolveAccountBindings({ profileIds: [] })
    ).resolves.toEqual({
      profileIds: [],
      bindings: [],
    });
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
    const repeated = Array.from({ length: 101 }, () => profileId);
    await expect(
      service.resolveAccountBindings({ profileIds: repeated })
    ).rejects.toBeInstanceOf(RpcException);
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });
});
