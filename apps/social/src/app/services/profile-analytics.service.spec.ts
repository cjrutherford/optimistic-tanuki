import { RpcException } from '@nestjs/microservices';
import { ProfileAnalyticsService } from './profile-analytics.service';

describe('ProfileAnalyticsService ownership and disclosure boundary', () => {
  const profileId = '5d9a1b6c-7e2f-4a83-9b10-2c4d6e8f0a12';
  const viewerId = '6e0b2c7d-8f30-4b94-a012-3d5e7f9a1b23';
  let repo: any;
  let queryBuilder: any;
  let service: ProfileAnalyticsService;

  beforeEach(() => {
    queryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    repo = {
      create: jest.fn((row) => row),
      save: jest.fn(async (row) => ({ id: 'row-secret', ...row })),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn(() => queryBuilder),
    };
    service = new ProfileAnalyticsService(repo);
  });

  it('rejects invalid profile or viewer UUIDs before persistence', async () => {
    await expect(
      service.recordView('not-a-uuid', viewerId, 'direct')
    ).rejects.toBeInstanceOf(RpcException);
    await expect(
      service.recordView(profileId, 'not-a-uuid', 'direct')
    ).rejects.toBeInstanceOf(RpcException);
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('normalizes UUIDs and source labels and returns no stored row fields', async () => {
    const result = await service.recordView(
      profileId.toUpperCase(),
      viewerId.toUpperCase(),
      'https://private.example/path'
    );
    expect(repo.create).toHaveBeenCalledWith({
      profileId,
      viewerId,
      source: 'other',
    });
    expect(result).toEqual({ success: true });
  });

  it('canonicalizes known sources and maps missing or unknown labels to other', async () => {
    for (const source of [
      'direct',
      'profile',
      'search',
      'feed',
      'other',
      'legacy raw value',
      undefined as unknown as string,
    ]) {
      await service.recordView(profileId, viewerId, source);
    }
    expect(repo.create.mock.calls.map(([row]) => row.source)).toEqual([
      'direct',
      'profile',
      'search',
      'feed',
      'other',
      'other',
      'other',
    ]);
  });

  it('counts uppercase legacy profile IDs with a case-insensitive canonical scope', async () => {
    await service.getViewStats(profileId.toUpperCase());
    expect(repo.count).toHaveBeenCalledTimes(4);
    for (const [options] of repo.count.mock.calls) {
      expect(options.where.profileId).toEqual(expect.anything());
      expect(options.where.profileId._type).toBe('raw');
      expect(options.where.profileId._getSql('profileId')).toContain(
        'LOWER(profileId)'
      );
      expect(options.where.profileId._objectLiteralParameters).toEqual({
        profileId,
      });
    }
    expect(repo.createQueryBuilder).toHaveBeenCalledWith('profileView');
    expect(queryBuilder.select).toHaveBeenCalledWith(
      'profileView.source',
      'source'
    );
    expect(queryBuilder.addSelect).toHaveBeenCalledWith(
      'profileView.viewedAt',
      'viewedAt'
    );
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'LOWER(profileView.profileId) = :profileId',
      { profileId }
    );
    expect(queryBuilder.orderBy).toHaveBeenCalledWith(
      'profileView.viewedAt',
      'DESC'
    );
    expect(queryBuilder.addOrderBy).toHaveBeenCalledWith(
      'profileView.id',
      'DESC'
    );
    expect(queryBuilder.take).toHaveBeenCalledWith(100);
  });

  it('returns timestamp-only stats and viewer projections despite extra repository fields', async () => {
    const viewedAt = new Date('2026-10-21T12:00:00Z');
    repo.count.mockResolvedValue(4);
    queryBuilder.getRawMany.mockResolvedValue([
      { id: 'secret', profileId, viewerId, source: 'https://legacy', viewedAt },
    ]);
    const stats = await service.getViewStats(profileId);
    expect(stats.recentViews).toEqual([{ viewedAt }]);
    expect(stats.topSources).toEqual([{ source: 'other', count: 1 }]);
    expect(JSON.stringify(stats)).not.toContain(viewerId);
    expect(JSON.stringify(stats)).not.toContain('secret');

    queryBuilder.select.mockClear();
    queryBuilder.addSelect.mockClear();
    queryBuilder.where.mockClear();
    queryBuilder.orderBy.mockClear();
    queryBuilder.addOrderBy.mockClear();
    queryBuilder.take.mockClear();
    const recent = await service.getRecentViewers(profileId);
    expect(queryBuilder.select).toHaveBeenCalledWith(
      'profileView.viewedAt',
      'viewedAt'
    );
    expect(queryBuilder.addSelect).not.toHaveBeenCalled();
    expect(queryBuilder.orderBy).toHaveBeenCalledWith(
      'profileView.viewedAt',
      'DESC'
    );
    expect(queryBuilder.addOrderBy).toHaveBeenCalledWith(
      'profileView.id',
      'DESC'
    );
    expect(queryBuilder.take).toHaveBeenCalledWith(10);
    expect(recent).toEqual([{ viewedAt }]);
    expect(JSON.stringify(recent)).not.toContain(viewerId);
  });

  it('enforces a bounded integer viewer limit and defaults to ten', async () => {
    await service.getRecentViewers(profileId);
    expect(queryBuilder.take).toHaveBeenLastCalledWith(10);
    await service.getRecentViewers(profileId, '25' as unknown as number);
    expect(queryBuilder.take).toHaveBeenLastCalledWith(25);
    for (const limit of [0, 101, 1.5, '1x', '01', null, {}, -1]) {
      await expect(
        service.getRecentViewers(profileId, limit as number)
      ).rejects.toBeInstanceOf(RpcException);
    }
    expect(queryBuilder.getRawMany).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid analytics UUID before querying', async () => {
    await expect(service.getViewStats('bad')).rejects.toBeInstanceOf(
      RpcException
    );
    await expect(service.getRecentViewers('bad')).rejects.toBeInstanceOf(
      RpcException
    );
    expect(repo.count).not.toHaveBeenCalled();
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });
});
