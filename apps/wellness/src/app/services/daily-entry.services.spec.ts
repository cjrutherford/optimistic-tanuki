import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';

import { DailyFourEntity } from '../entities/daily-four.entity';
import { DailySixEntity } from '../entities/daily-six.entity';
import { DailyFourService } from './daily-four.service';
import { DailySixService } from './daily-six.service';

/**
 * DailyFourService and DailySixService are the same service over two entities:
 * same create/find/update/delete shape, same ownership rules, differing only in
 * the entity they persist and the wording of their not-found messages. They are
 * driven from one table here so a change to one that is not made to the other
 * shows up as a failure rather than as untested code.
 */

interface QueryBuilderMock {
  orderBy: jest.Mock;
  where: jest.Mock;
  getMany: jest.Mock;
}

interface RepositoryMock {
  create: jest.Mock;
  save: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
  remove: jest.Mock;
  createQueryBuilder: jest.Mock;
}

/** The subset of both services this spec exercises. */
interface DailyService {
  create(profileId: string, dto: Record<string, unknown>): Promise<unknown>;
  findByProfileId(profileId: string): Promise<unknown[]>;
  findAll(publicOnly?: boolean): Promise<unknown[]>;
  update(
    id: string,
    profileId: string,
    dto: Record<string, unknown>
  ): Promise<unknown>;
  delete(id: string, profileId: string): Promise<void>;
}

const cases = [
  {
    name: 'DailyFourService',
    Service: DailyFourService,
    Entity: DailyFourEntity,
    notFound: 'DailyFour entry not found',
    dto: {
      affirmation: 'I can do hard things',
      mindfulActivity: 'A walk',
      gratitude: 'Coffee',
      plannedPleasurable: 'Reading',
    },
  },
  {
    name: 'DailySixService',
    Service: DailySixService,
    Entity: DailySixEntity,
    notFound: 'DailySix entry not found',
    dto: {
      affirmation: 'I can do hard things',
      judgement: 'I was harsh',
      nonJudgement: 'I was fair',
      mindfulActivity: 'A walk',
      gratitude: 'Coffee',
    },
  },
] as const;

describe.each(cases)('$name', ({ Service, Entity, notFound, dto }) => {
  let service: DailyService;
  let repository: RepositoryMock;
  let queryBuilder: QueryBuilderMock;

  beforeEach(async () => {
    queryBuilder = {
      orderBy: jest.fn(),
      where: jest.fn(),
      getMany: jest.fn(async () => []),
    };
    // orderBy and where are chained off the builder, so both return it.
    queryBuilder.orderBy.mockReturnValue(queryBuilder);
    queryBuilder.where.mockReturnValue(queryBuilder);

    repository = {
      create: jest.fn((input: unknown) => input),
      save: jest.fn(async (input: object) => ({ id: 'saved-id', ...input })),
      find: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
      remove: jest.fn(async () => undefined),
      createQueryBuilder: jest.fn(() => queryBuilder),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        Service,
        { provide: getRepositoryToken(Entity), useValue: repository },
      ],
    }).compile();

    service = moduleRef.get(Service) as unknown as DailyService;
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('create', () => {
    it('stamps the profile id onto the entry and saves it', async () => {
      const saved = await service.create('profile-1', { ...dto });

      expect(repository.create).toHaveBeenCalledWith({
        ...dto,
        profileId: 'profile-1',
        public: false,
      });
      expect(repository.save).toHaveBeenCalledWith({
        ...dto,
        profileId: 'profile-1',
        public: false,
      });
      expect(saved).toMatchObject({ id: 'saved-id', profileId: 'profile-1' });
    });

    it.each([
      ['defaults to private when public is omitted', undefined, false],
      ['keeps an explicit false', false, false],
      ['keeps an explicit true', true, true],
    ])('%s', async (_case, provided, expected) => {
      await service.create('profile-1', { ...dto, public: provided });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ public: expected })
      );
    });
  });

  describe('findByProfileId', () => {
    it('reads that profile only, newest first', async () => {
      repository.find.mockResolvedValue([{ id: 'entry-1' }]);

      const found = await service.findByProfileId('profile-1');

      expect(repository.find).toHaveBeenCalledWith({
        where: { profileId: 'profile-1' },
        order: { createdAt: 'DESC' },
      });
      expect(found).toEqual([{ id: 'entry-1' }]);
    });
  });

  describe('findAll', () => {
    it('returns everything newest first when publicOnly is not set', async () => {
      queryBuilder.getMany.mockResolvedValue([{ id: 'entry-1' }]);

      const found = await service.findAll();

      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'entry.createdAt',
        'DESC'
      );
      expect(queryBuilder.where).not.toHaveBeenCalled();
      expect(found).toEqual([{ id: 'entry-1' }]);
    });

    it('filters to public entries when publicOnly is set', async () => {
      await service.findAll(true);

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'entry.public = :public',
        { public: true }
      );
    });

    it('does not filter when publicOnly is explicitly false', async () => {
      await service.findAll(false);

      expect(queryBuilder.where).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('applies the patch to the owner’s entry and saves it', async () => {
      repository.findOne.mockResolvedValue({
        id: 'entry-1',
        profileId: 'profile-1',
        affirmation: 'Old',
      });

      const updated = await service.update('entry-1', 'profile-1', {
        affirmation: 'New',
      });

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'entry-1' },
      });
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'entry-1', affirmation: 'New' })
      );
      expect(updated).toMatchObject({ affirmation: 'New' });
    });

    it('refuses an entry that does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.update('missing', 'profile-1', { affirmation: 'New' })
      ).rejects.toThrow(RpcException);
      await expect(
        service.update('missing', 'profile-1', { affirmation: 'New' })
      ).rejects.toThrow(notFound);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('refuses an entry belonging to another profile', async () => {
      repository.findOne.mockResolvedValue({
        id: 'entry-1',
        profileId: 'someone-else',
      });

      await expect(
        service.update('entry-1', 'profile-1', { affirmation: 'New' })
      ).rejects.toThrow('Not authorized to update this entry');
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('removes the owner’s entry', async () => {
      const entry = { id: 'entry-1', profileId: 'profile-1' };
      repository.findOne.mockResolvedValue(entry);

      await service.delete('entry-1', 'profile-1');

      expect(repository.remove).toHaveBeenCalledWith(entry);
    });

    it('refuses an entry that does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.delete('missing', 'profile-1')).rejects.toThrow(
        notFound
      );
      expect(repository.remove).not.toHaveBeenCalled();
    });

    it('refuses an entry belonging to another profile', async () => {
      repository.findOne.mockResolvedValue({
        id: 'entry-1',
        profileId: 'someone-else',
      });

      await expect(service.delete('entry-1', 'profile-1')).rejects.toThrow(
        'Not authorized to delete this entry'
      );
      expect(repository.remove).not.toHaveBeenCalled();
    });
  });
});
