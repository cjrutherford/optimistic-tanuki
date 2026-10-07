import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { CommunityCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { of, throwError } from 'rxjs';
import { ClassifiedsService } from './classifieds.service';
import { ClassifiedAdEntity } from './entities/classified-ad.entity';

/**
 * Named interfaces rather than index-signature maps: this project compiles specs
 * with `noPropertyAccessFromIndexSignature`, which rejects `repo.save(...)` on a
 * `{ [key: string]: jest.Mock }` mock.
 */
interface MockQueryBuilder {
  where: jest.Mock;
  andWhere: jest.Mock;
  skip: jest.Mock;
  take: jest.Mock;
  orderBy: jest.Mock;
  addOrderBy: jest.Mock;
  getMany: jest.Mock;
}

interface MockRepository {
  create: jest.Mock;
  save: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
  createQueryBuilder: jest.Mock;
}

/** Every chained builder method returns the builder so the service can fluently chain. */
function createMockQueryBuilder(): MockQueryBuilder {
  const qb: Partial<MockQueryBuilder> = {};
  const chain = jest.fn(() => qb as MockQueryBuilder);
  qb.where = chain;
  qb.andWhere = jest.fn(() => qb as MockQueryBuilder);
  qb.skip = jest.fn(() => qb as MockQueryBuilder);
  qb.take = jest.fn(() => qb as MockQueryBuilder);
  qb.orderBy = jest.fn(() => qb as MockQueryBuilder);
  qb.addOrderBy = jest.fn(() => qb as MockQueryBuilder);
  qb.getMany = jest.fn().mockResolvedValue([]);
  return qb as MockQueryBuilder;
}

function createAd(
  overrides: Partial<ClassifiedAdEntity> = {}
): ClassifiedAdEntity {
  return {
    id: 'ad-1',
    title: 'Bicycle',
    description: 'A red bicycle',
    price: 120,
    currency: 'USD',
    category: 'sporting-goods',
    condition: 'used',
    imageUrls: null,
    status: 'active',
    communityId: 'community-1',
    profileId: 'profile-1',
    userId: 'user-1',
    appScope: 'local-hub',
    isFeatured: false,
    featuredUntil: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    expiresAt: null,
    ...overrides,
  } as ClassifiedAdEntity;
}

describe('ClassifiedsService', () => {
  let service: ClassifiedsService;
  let repo: MockRepository;
  let qb: MockQueryBuilder;
  let socialClient: { send: jest.Mock };

  beforeEach(async () => {
    qb = createMockQueryBuilder();
    repo = {
      create: jest.fn((input: Partial<ClassifiedAdEntity>) => input),
      save: jest.fn((input: ClassifiedAdEntity) => Promise.resolve(input)),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn(() => qb),
    };
    socialClient = {
      send: jest.fn((pattern: { cmd: string }) =>
        of(
          pattern.cmd === CommunityCommands.FIND
            ? {
                id: 'community-1',
                appScope: 'local-hub',
                isPrivate: false,
              }
            : true
        )
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassifiedsService,
        { provide: getRepositoryToken(ClassifiedAdEntity), useValue: repo },
        { provide: ServiceTokens.SOCIAL_SERVICE, useValue: socialClient },
      ],
    }).compile();

    service = module.get(ClassifiedsService);
  });

  describe('create', () => {
    it('stamps ownership, scope and active status onto the new ad', async () => {
      const saved = createAd();
      repo.save.mockResolvedValue(saved);
      socialClient.send.mockReturnValue(
        of({ id: 'community-1', appScope: 'regional-hub', isPrivate: false })
      );
      socialClient.send.mockReturnValueOnce(
        of({ id: 'community-1', appScope: 'regional-hub', isPrivate: false })
      );
      socialClient.send.mockReturnValueOnce(of(true));

      const result = await service.create(
        {
          title: 'Bicycle',
          description: 'A red bicycle',
          price: 120,
          communityId: 'community-1',
        },
        'profile-1',
        'user-1',
        'regional-hub'
      );

      expect(repo.create).toHaveBeenCalledWith({
        title: 'Bicycle',
        description: 'A red bicycle',
        price: 120,
        communityId: 'community-1',
        profileId: 'profile-1',
        userId: 'user-1',
        appScope: 'regional-hub',
        status: 'active',
        currency: 'USD',
      });
      expect(repo.save).toHaveBeenCalledWith(repo.create.mock.results[0].value);
      expect(result).toBe(saved);
    });

    it('requires an explicit appScope and keeps an explicit currency', async () => {
      await service.create(
        {
          title: 'Guitar',
          description: 'Acoustic guitar',
          price: 300,
          currency: 'CAD',
        },
        'profile-2',
        'user-2',
        'local-hub'
      );

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ appScope: 'local-hub', currency: 'CAD' })
      );
    });

    it('rejects a missing appScope before writing', async () => {
      await expect(
        service.create(
          { title: 'Guitar', description: 'Acoustic guitar', price: 300 },
          'profile-2',
          'user-2'
        )
      ).rejects.toMatchObject({ error: { statusCode: 400 } });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rejects caller-supplied identifiers, ownership, scope, and lifecycle fields', async () => {
      await expect(
        service.create(
          {
            title: 'Forged listing',
            description: 'Must not persist',
            price: 1,
            id: 'existing-ad',
            profileId: 'victim-profile',
            userId: 'victim-user',
            appScope: 'client-interface',
            status: 'sold',
          } as never,
          'profile-1',
          'user-1',
          'local-hub'
        )
      ).rejects.toMatchObject({ error: { statusCode: 400 } });
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('requires current approved membership and matching community scope', async () => {
      socialClient.send.mockImplementation((pattern: { cmd: string }) =>
        of(
          pattern.cmd === CommunityCommands.FIND
            ? { id: 'community-1', appScope: 'local-hub', isPrivate: false }
            : false
        )
      );

      await expect(
        service.create(
          {
            title: 'Table',
            description: 'Wood',
            price: 50,
            communityId: 'community-1',
          },
          'profile-1',
          'user-pending',
          'local-hub'
        )
      ).rejects.toMatchObject({ error: { statusCode: 403 } });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('fails closed when the community lookup is unavailable', async () => {
      socialClient.send.mockReturnValue(
        throwError(() => new Error('social down'))
      );

      await expect(
        service.create(
          {
            title: 'Table',
            description: 'Wood',
            price: 50,
            communityId: 'community-1',
          },
          'profile-1',
          'user-1',
          'local-hub'
        )
      ).rejects.toMatchObject({ error: { statusCode: 503 } });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('refuses posting to a community in another app scope', async () => {
      socialClient.send.mockImplementation((pattern: { cmd: string }) =>
        of(
          pattern.cmd === CommunityCommands.FIND
            ? { id: 'community-1', appScope: 'client-interface' }
            : true
        )
      );

      await expect(
        service.create(
          {
            title: 'Table',
            description: 'Wood',
            price: 50,
            communityId: 'community-1',
          },
          'profile-1',
          'user-1',
          'local-hub'
        )
      ).rejects.toMatchObject({ error: { statusCode: 404 } });
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns only the ad matching the requested app scope', async () => {
      const ad = createAd();
      repo.findOne.mockResolvedValue(ad);

      await expect(service.findById('ad-1', 'local-hub')).resolves.toBe(ad);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'ad-1', appScope: 'local-hub' },
      });
    });

    it('throws an RpcException naming the missing id', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findById('missing-ad', 'local-hub')).rejects.toThrow(
        RpcException
      );
      await expect(service.findById('missing-ad', 'local-hub')).rejects.toThrow(
        'Classified ad missing-ad not found'
      );
    });
  });

  describe('findByCommunity', () => {
    it('filters on the community and app scope, featured ads first', async () => {
      const ads = [createAd()];
      repo.find.mockResolvedValue(ads);
      socialClient.send.mockReturnValue(
        of({ id: 'community-1', appScope: 'regional-hub', isPrivate: false })
      );

      await expect(
        service.findByCommunity('community-1', 'regional-hub')
      ).resolves.toBe(ads);
      expect(repo.find).toHaveBeenCalledWith({
        where: {
          communityId: 'community-1',
          appScope: 'regional-hub',
          status: 'active',
        },
        order: { isFeatured: 'DESC', createdAt: 'DESC' },
      });
    });

    it('omits the app scope filter entirely when none is supplied', async () => {
      await expect(
        service.findByCommunity('community-1', undefined as never)
      ).rejects.toThrow(RpcException);
      expect(repo.find).not.toHaveBeenCalled();
    });

    it('hides private-community ads from anonymous and unapproved readers', async () => {
      socialClient.send.mockImplementation((pattern: { cmd: string }) =>
        of(
          pattern.cmd === CommunityCommands.FIND
            ? { id: 'community-1', appScope: 'local-hub', isPrivate: true }
            : false
        )
      );

      await expect(
        service.findByCommunity('community-1', 'local-hub')
      ).resolves.toEqual([]);
      await expect(
        service.findByCommunity('community-1', 'local-hub', 'pending-user')
      ).resolves.toEqual([]);
      expect(repo.find).not.toHaveBeenCalled();
    });

    it('allows an approved community member to read private-community ads', async () => {
      const ads = [createAd()];
      repo.find.mockResolvedValue(ads);
      socialClient.send.mockImplementation((pattern: { cmd: string }) =>
        of(
          pattern.cmd === CommunityCommands.FIND
            ? { id: 'community-1', appScope: 'local-hub', isPrivate: true }
            : true
        )
      );

      await expect(
        service.findByCommunity('community-1', 'local-hub', 'approved-user')
      ).resolves.toEqual(ads);
      expect(socialClient.send).toHaveBeenCalledWith(
        { cmd: 'IS_COMMUNITY_MEMBER' },
        { communityId: 'community-1', userId: 'approved-user' }
      );
    });
  });

  describe('findByProfile', () => {
    it('returns only ads for the profile and app scope, newest first', async () => {
      const ads = [createAd(), createAd({ id: 'ad-2' })];
      repo.find.mockResolvedValue(ads);

      await expect(
        service.findByProfile('profile-1', 'local-hub')
      ).resolves.toEqual(ads);
      expect(repo.find).toHaveBeenCalledWith({
        where: { profileId: 'profile-1', appScope: 'local-hub' },
        order: { createdAt: 'DESC' },
      });
    });

    it('keeps an owner’s private-community ad in their own listing view after membership ends', async () => {
      const ownedAd = createAd({ userId: 'former-member' });
      repo.find.mockResolvedValue([ownedAd]);
      socialClient.send.mockImplementation((pattern: { cmd: string }) =>
        of(
          pattern.cmd === CommunityCommands.FIND
            ? { id: 'community-1', appScope: 'local-hub', isPrivate: true }
            : false
        )
      );

      await expect(
        service.findByProfile('profile-1', 'local-hub', 'former-member')
      ).resolves.toEqual([ownedAd]);
    });
  });

  describe('public by-id privacy boundary', () => {
    it('conceals a private-community listing from anonymous readers', async () => {
      repo.findOne.mockResolvedValue(createAd());
      socialClient.send.mockReturnValue(
        of({ id: 'community-1', appScope: 'local-hub', isPrivate: true })
      );

      await expect(service.findById('ad-1', 'local-hub')).rejects.toMatchObject(
        {
          error: { statusCode: 404 },
        }
      );
    });

    it('allows the approved member to read a private-community listing', async () => {
      const ad = createAd();
      repo.findOne.mockResolvedValue(ad);
      socialClient.send.mockImplementation((pattern: { cmd: string }) =>
        of(
          pattern.cmd === CommunityCommands.FIND
            ? { id: 'community-1', appScope: 'local-hub', isPrivate: true }
            : true
        )
      );

      await expect(
        service.findById('ad-1', 'local-hub', 'member-user')
      ).resolves.toBe(ad);
    });

    it('keeps the listing owner able to read their own private listing after leaving', async () => {
      const ad = createAd({ userId: 'former-member' });
      repo.findOne.mockResolvedValue(ad);
      socialClient.send.mockImplementation((pattern: { cmd: string }) =>
        of(
          pattern.cmd === CommunityCommands.FIND
            ? { id: 'community-1', appScope: 'local-hub', isPrivate: true }
            : false
        )
      );

      await expect(
        service.findById('ad-1', 'local-hub', 'former-member')
      ).resolves.toBe(ad);
    });
  });

  describe('search', () => {
    it('always restricts to active ads and applies default paging', async () => {
      const ads = [createAd()];
      qb.getMany.mockResolvedValue(ads);

      await expect(service.search({ appScope: 'local-hub' })).resolves.toEqual(
        ads
      );

      expect(repo.createQueryBuilder).toHaveBeenCalledWith('ad');
      expect(qb.where).toHaveBeenCalledWith('ad.status = :status', {
        status: 'active',
      });
      // No optional filters supplied, so no andWhere clauses should be added.
      expect(qb.andWhere).toHaveBeenCalledWith('ad.appScope = :appScope', {
        appScope: 'local-hub',
      });
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
      expect(qb.orderBy).toHaveBeenCalledWith('ad.isFeatured', 'DESC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('ad.createdAt', 'DESC');
    });

    it('adds every optional filter clause with its bound parameters', async () => {
      await service.search({
        communityId: 'community-9',
        appScope: 'regional-hub',
        query: 'bike',
        category: 'sporting-goods',
        minPrice: 10,
        maxPrice: 500,
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'ad.communityId = :communityId',
        {
          communityId: 'community-9',
        }
      );
      expect(qb.andWhere).toHaveBeenCalledWith('ad.appScope = :appScope', {
        appScope: 'regional-hub',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(ad.title ILIKE :query OR ad.description ILIKE :query)',
        { query: '%bike%' }
      );
      expect(qb.andWhere).toHaveBeenCalledWith('ad.category = :category', {
        category: 'sporting-goods',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('ad.price >= :minPrice', {
        minPrice: 10,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('ad.price <= :maxPrice', {
        maxPrice: 500,
      });
      expect(qb.andWhere).toHaveBeenCalledTimes(6);
    });

    it('treats a zero price bound as a real filter rather than a missing one', async () => {
      await service.search({ minPrice: 0, maxPrice: 0, appScope: 'local-hub' });

      expect(qb.andWhere).toHaveBeenCalledWith('ad.price >= :minPrice', {
        minPrice: 0,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('ad.price <= :maxPrice', {
        maxPrice: 0,
      });
    });

    it.each([
      { page: 3, limit: 10, skip: 20, take: 10 },
      { page: 1, limit: 250, skip: 0, take: 100 },
      { page: 2, limit: undefined, skip: 20, take: 20 },
    ])(
      'pages with page=$page limit=$limit as skip=$skip take=$take',
      async ({ page, limit, skip, take }) => {
        await service.search({ page, limit, appScope: 'local-hub' });

        expect(qb.skip).toHaveBeenCalledWith(skip);
        expect(qb.take).toHaveBeenCalledWith(take);
      }
    );
  });

  describe('update', () => {
    it('merges the changes onto the owned ad and saves it', async () => {
      const ad = createAd();
      repo.findOne.mockResolvedValue(ad);

      const result = await service.update(
        'ad-1',
        { title: 'Blue bicycle', price: 90 },
        'profile-1',
        'local-hub'
      );

      expect(result).toMatchObject({ title: 'Blue bicycle', price: 90 });
      expect(repo.save).toHaveBeenCalledWith(ad);
    });

    it('refuses an update from a profile that does not own the ad', async () => {
      repo.findOne.mockResolvedValue(createAd({ profileId: 'profile-1' }));

      await expect(
        service.update(
          'ad-1',
          { title: 'Hijacked' },
          'profile-other',
          'local-hub'
        )
      ).rejects.toThrow('Forbidden: not the owner of this classified ad');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it.each([
      ['community retargeting', { communityId: 'private-community' }],
      ['id replacement', { id: 'another-listing' }],
      ['profile ownership', { profileId: 'victim-profile' }],
      ['user ownership', { userId: 'victim-user' }],
      ['app scope', { appScope: 'client-interface' }],
      ['status', { status: 'active' }],
    ])(
      'rejects %s before any repository read or write',
      async (_name, fields) => {
        await expect(
          service.update('ad-1', fields as never, 'profile-1', 'local-hub')
        ).rejects.toMatchObject({ error: { statusCode: 400 } });
        expect(repo.findOne).not.toHaveBeenCalled();
        expect(repo.save).not.toHaveBeenCalled();
      }
    );
  });

  describe('remove', () => {
    it('soft-deletes by flipping the status to removed', async () => {
      const ad = createAd();
      repo.findOne.mockResolvedValue(ad);

      await expect(
        service.remove('ad-1', 'profile-1', 'local-hub')
      ).resolves.toMatchObject({ status: 'removed' });
      expect(ad.status).toBe('removed');
      expect(repo.save).toHaveBeenCalledWith(ad);
    });

    it('refuses removal by a non-owner and leaves the status untouched', async () => {
      const ad = createAd({ profileId: 'profile-1' });
      repo.findOne.mockResolvedValue(ad);

      await expect(
        service.remove('ad-1', 'profile-other', 'local-hub')
      ).rejects.toThrow('Forbidden: not the owner of this classified ad');
      expect(ad.status).toBe('active');
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('markSold', () => {
    it('sets the status to sold for the owner', async () => {
      const ad = createAd();
      repo.findOne.mockResolvedValue(ad);

      const result = await service.markSold('ad-1', 'profile-1', 'local-hub');

      expect(result.status).toBe('sold');
      expect(repo.save).toHaveBeenCalledWith(ad);
    });

    it('refuses to mark an ad sold on behalf of another profile', async () => {
      const ad = createAd({ profileId: 'profile-1' });
      repo.findOne.mockResolvedValue(ad);

      await expect(
        service.markSold('ad-1', 'profile-other', 'local-hub')
      ).rejects.toThrow('Forbidden: not the owner of this classified ad');
      expect(ad.status).toBe('active');
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('feature', () => {
    it('flags the ad as featured until durationDays from now', async () => {
      // Fixed clock so the computed featuredUntil is deterministic.
      jest.useFakeTimers().setSystemTime(new Date('2026-03-10T12:00:00.000Z'));
      try {
        const ad = createAd();
        repo.findOne.mockResolvedValue(ad);

        const result = await service.feature(
          'ad-1',
          'profile-1',
          7,
          'local-hub'
        );

        expect(result.isFeatured).toBe(true);
        expect(result.featuredUntil).toEqual(
          new Date('2026-03-17T12:00:00.000Z')
        );
        expect(repo.save).toHaveBeenCalledWith(ad);
      } finally {
        jest.useRealTimers();
      }
    });

    it('propagates the not-found error for an unknown ad', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.feature('nope', 'profile-1', 7, 'local-hub')
      ).rejects.toThrow('Classified ad nope not found');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('refuses to feature an ad owned by another profile', async () => {
      // isFeatured drives the listing order, so featuring someone else's ad
      // would let any caller promote or bury a listing they do not own.
      const ad = createAd({ profileId: 'profile-1' });
      repo.findOne.mockResolvedValue(ad);

      await expect(
        service.feature('ad-1', 'profile-other', 7, 'local-hub')
      ).rejects.toThrow('Forbidden: not the owner of this classified ad');
      expect(ad.isFeatured).toBe(false);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('unfeature', () => {
    it('clears the featured flag and its expiry', async () => {
      const ad = createAd({
        isFeatured: true,
        featuredUntil: new Date('2026-04-01T00:00:00.000Z'),
      });
      repo.findOne.mockResolvedValue(ad);

      const result = await service.unfeature('ad-1', 'profile-1', 'local-hub');

      expect(result.isFeatured).toBe(false);
      expect(result.featuredUntil).toBeNull();
      expect(repo.save).toHaveBeenCalledWith(ad);
    });

    it('refuses to unfeature an ad owned by another profile', async () => {
      const ad = createAd({
        profileId: 'profile-1',
        isFeatured: true,
        featuredUntil: new Date('2026-04-01T00:00:00.000Z'),
      });
      repo.findOne.mockResolvedValue(ad);

      await expect(
        service.unfeature('ad-1', 'profile-other', 'local-hub')
      ).rejects.toThrow('Forbidden: not the owner of this classified ad');
      expect(ad.isFeatured).toBe(true);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
