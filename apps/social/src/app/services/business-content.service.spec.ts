import { In } from 'typeorm';
import { BusinessContentService } from './business-content.service';

function repository(initial: Record<string, any> = {}) {
  const rows = new Map<string, any>(Object.entries(initial));
  return {
    rows,
    find: jest.fn(async (opts?: any) => {
      const all = [...rows.values()];
      if (!opts?.where) {
        return all;
      }
      return all.filter((row) =>
        Object.entries(opts.where).every(([key, value]) => {
          if (value && typeof value === 'object' && 'value' in (value as any)) {
            return true;
          }
          if (Array.isArray(value)) {
            return (value as unknown[]).includes(row[key]);
          }
          return row[key] === value;
        })
      );
    }),
    findOne: jest.fn(async ({ where }: any) => {
      const found = [...rows.values()].find((row) =>
        Object.entries(where ?? {}).every(([key, value]) => row[key] === value)
      );
      return found ?? null;
    }),
    create: jest.fn((input: object) => input),
    save: jest.fn(async (input: any) => ({
      id: `id-${Math.random().toString(36).slice(2, 8)}`,
      ...input,
    })),
  };
}

describe('BusinessContentService (O13 content reads)', () => {
  it('creates a business page once (idempotent on community)', async () => {
    const pages = repository();
    const service = new BusinessContentService(
      pages as never,
      repository() as never,
      repository() as never
    );

    const first = await service.createBusinessPage({
      communityId: 'community-1',
      ownerId: 'user-1',
    });
    pages.rows.set(first.id, first);

    const second = await service.createBusinessPage({
      communityId: 'community-1',
      ownerId: 'user-1',
    });

    expect(second.id).toBe(first.id);
    expect(pages.save).toHaveBeenCalledTimes(1);
  });

  it('updates only the owning page', async () => {
    const pages = repository({
      page1: { id: 'page-1', communityId: 'c-1', ownerId: 'user-1' },
    });
    const service = new BusinessContentService(
      pages as never,
      repository() as never,
      repository() as never
    );

    await expect(
      service.updateBusinessPage('c-1', 'user-1', { name: 'New name' } as never)
    ).resolves.toMatchObject({ name: 'New name' });
    await expect(
      service.updateBusinessPage('c-1', 'stranger', {} as never)
    ).resolves.toBeNull();
  });

  it('lists pages for communities and sponsorships by status', async () => {
    const pages = repository({
      a: { id: 'a', communityId: 'c-1' },
      b: { id: 'b', communityId: 'c-2' },
    });
    const sponsorships = repository({
      s1: { id: 's1', communityId: 'c-1', userId: 'u-1', status: 'active' },
      s2: { id: 's2', communityId: 'c-1', userId: 'u-1', status: 'pending' },
    });
    const service = new BusinessContentService(
      pages as never,
      repository() as never,
      sponsorships as never
    );

    // `In()` is a TypeORM operator — assert it reaches the repository
    // untouched rather than re-testing TypeORM itself.
    await service.getBusinessPagesByCommunityIds(['c-1']);
    expect(pages.find).toHaveBeenCalledWith({
      where: { communityId: In(['c-1']) },
    });
    await expect(service.getBusinessPagesByCommunityIds([])).resolves.toEqual(
      []
    );
    await expect(service.getActiveSponsorships('c-1')).resolves.toEqual([
      expect.objectContaining({ id: 's1' }),
    ]);
    await expect(service.getUserSponsorships('u-1')).resolves.toHaveLength(2);
  });
});
