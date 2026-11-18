import { CommunityService } from './community.service';
import * as authority from './social-authority';

// Contract tests supply synthetic peer evidence; the real provider stays fail-closed.
beforeEach(() => {
  jest
    .spyOn(authority, 'trustedDirectoryRuntimeEpochs')
    .mockReturnValue({ sourceEpoch: epoch, recoveryEpoch: epoch });
});
afterEach(() => jest.restoreAllMocks());

describe('directory eligibility', () => {
  it('selects only public local-hub city/town fields and omits all other data', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'id',
        name: 'Town',
        slug: null,
        adminArea: null,
        localityType: 'town',
        ownerId: 'secret',
      }),
    };
    (repo as any).manager = managerFor(repo);
    const service = new CommunityService(
      repo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
    expect(await service.findDirectoryEligible('id')).toEqual({ id: 'id' });
    expect(repo.findOne.mock.calls[0][0].select).toEqual({
      id: true,
      localityType: true,
      adminArea: true,
    });
    expect(repo.findOne.mock.calls[0][0].where).toMatchObject({
      id: 'id',
      appScope: 'local-hub',
      isPrivate: false,
    });
    // A locality merged into another town is never an eligible town.
    expect(repo.findOne.mock.calls[0][0].where.mergedIntoId).toBeDefined();
    repo.findOne.mockResolvedValueOnce({
      id: 'id',
      localityType: 'town',
      adminArea: 'Development fixture',
    });
    expect(await service.findDirectoryEligible('id')).toBeNull();
    repo.findOne
      .mockResolvedValueOnce({ localityType: 'neighborhood' })
      .mockResolvedValueOnce(null);
    expect(await service.findDirectoryEligible('id')).toBeNull();
    expect(await service.findDirectoryEligible('id')).toBeNull();
  });
});

const epoch = '00000000-0000-4000-8000-000000000001';
const managerFor = (repo: any) => ({
  transaction: async (fn: any) =>
    fn({
      queryRunner: { isTransactionActive: true },
      query: async () => [
        {
          sourceEpoch: epoch,
          directoryRecoveryEpoch: epoch,
          fenced: false,
          phase: 'active',
          activationId: epoch,
          owner: epoch,
          socialGeneration: '1',
          directoryGeneration: '1',
          preparedPayload: {
            accepted: {
              version: 'directory-enabled-v1',
              digest: 'a'.repeat(64),
            },
          },
        },
      ],
      getRepository: () => repo,
    }),
});

describe('directory census', () => {
  it('uses bounded UUID keyset pages and selects only eligible locality fields', async () => {
    const rows = [
      {
        id: '00000000-0000-4000-8000-000000000002',
        name: 'Town',
        slug: null,
        adminArea: null,
        localityType: 'town',
      },
    ];
    const qb: any = {};
    for (const method of ['select', 'where', 'andWhere', 'orderBy', 'take'])
      qb[method] = jest.fn().mockReturnValue(qb);
    qb.getMany = jest.fn().mockResolvedValue(rows);
    const repo: any = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    repo.manager = managerFor(repo);
    const service = new CommunityService(
      repo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
    const cursor = '00000000-0000-4000-8000-000000000001';
    expect(await service.findDirectoryCensus(epoch, cursor, 10000)).toEqual({
      communities: rows,
      nextCursor: null,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('community.id > :cursor', {
      cursor,
    });
    expect(qb.take).toHaveBeenCalledWith(201);
    expect(qb.orderBy).toHaveBeenCalledWith('community.id', 'ASC');
    expect(qb.select).toHaveBeenCalledWith(['community.id']);
  });

  it('returns the last included UUID as the continuation cursor', async () => {
    const rows = [1, 2, 3].map((n) => ({
      id: `00000000-0000-4000-8000-00000000000${n}`,
      name: 'Town',
      slug: null,
      adminArea: null,
      localityType: 'town',
    }));
    const qb: any = {};
    for (const method of ['select', 'where', 'andWhere', 'orderBy', 'take'])
      qb[method] = jest.fn().mockReturnValue(qb);
    qb.getMany = jest.fn().mockResolvedValue(rows);
    const repo: any = { createQueryBuilder: () => qb };
    repo.manager = managerFor(repo);
    const service = new CommunityService(
      repo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
    expect(await service.findDirectoryCensus(epoch, undefined, 2)).toEqual({
      communities: rows.slice(0, 2),
      nextCursor: rows[1].id,
    });
  });

  it('rejects invalid cursors and limits before querying', async () => {
    const repo = { createQueryBuilder: jest.fn() };
    const service = new CommunityService(
      repo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
    await expect(
      service.findDirectoryCensus(epoch, 'bad', 5)
    ).rejects.toThrow();
    await expect(
      service.findDirectoryCensus(epoch, undefined, 0)
    ).rejects.toThrow();
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });
});

describe('directory snapshot privacy', () => {
  it('queries only eligible public towns and selects no private fields', async () => {
    const repo: any = { findOne: jest.fn().mockResolvedValue(null) };
    repo.manager = managerFor(repo);
    const service = new CommunityService(
      repo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
    expect(
      await service.directorySnapshot(
        '00000000-0000-4000-8000-000000000001',
        epoch
      )
    ).toBeNull();
    const query = repo.findOne.mock.calls[0][0];
    expect(query.where).toMatchObject({
      appScope: 'local-hub',
      isPrivate: false,
    });
    expect(query.where.localityType.value).toEqual(['city', 'town']);
    expect(query.where.mergedIntoId).toBeDefined();
    expect(Object.keys(query.select).sort()).toEqual([
      'adminArea',
      'appScope',
      'id',
      'isPrivate',
      'localityType',
      'name',
      'slug',
    ]);
  });
});

it('fails closed when trusted directory authority is unavailable', async () => {
  jest.restoreAllMocks();
  const repo: any = { findOne: jest.fn() };
  repo.manager = managerFor(repo);
  const service = new CommunityService(
    repo,
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
    null as any
  );
  await expect(service.findDirectoryEligible(epoch)).rejects.toThrow(
    'authority unavailable'
  );
  expect(repo.findOne).not.toHaveBeenCalled();
});
