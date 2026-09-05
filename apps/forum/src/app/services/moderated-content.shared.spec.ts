import { Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForumPost } from '../../entities/forum-post.entity';
import { Thread } from '../../entities/thread.entity';
import { ForumPostService } from './forum-post.service';
import { ThreadService } from './thread.service';

/**
 * ThreadService and ForumPostService carry byte-identical implementations of
 * the default moderation filter and of `moderate`. They are exercised from a
 * single table here so that changing one service without the other fails.
 */

interface ModeratedRepoMock {
  find: jest.Mock;
  findOne: jest.Mock;
  update: jest.Mock;
}

/**
 * Structural view of the two services: the concrete classes are typed against
 * their own entity, so the shared table addresses them through the subset of
 * methods under test.
 */
interface ModeratedService {
  findAll(options?: Record<string, unknown>): Promise<unknown[]>;
  moderate(
    id: string,
    moderationStatus: 'visible' | 'hidden',
    moderatedBy: string,
    moderationNotes?: string
  ): Promise<unknown>;
}

const services: Array<{
  name: string;
  serviceClass: Type<unknown>;
  entity: Type<unknown>;
  notFoundMessage: (id: string) => string;
}> = [
  {
    name: 'ThreadService',
    serviceClass: ThreadService,
    entity: Thread,
    notFoundMessage: (id) => `Thread with ID ${id} not found`,
  },
  {
    name: 'ForumPostService',
    serviceClass: ForumPostService,
    entity: ForumPost,
    notFoundMessage: (id) => `Forum post with ID ${id} not found`,
  },
];

describe.each(services)(
  '$name moderation behaviour',
  ({ serviceClass, entity, notFoundMessage }) => {
    let service: ModeratedService;
    let repo: ModeratedRepoMock;

    beforeEach(async () => {
      repo = {
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      const module = await Test.createTestingModule({
        providers: [
          serviceClass,
          { provide: getRepositoryToken(entity), useValue: repo },
        ],
      }).compile();

      service = module.get<ModeratedService>(serviceClass);
    });

    describe('findAll default moderation filter', () => {
      it('restricts an unfiltered query to visible content', async () => {
        const rows = [{ id: 'a' }];
        repo.find.mockResolvedValue(rows);

        await expect(service.findAll()).resolves.toBe(rows);
        expect(repo.find).toHaveBeenCalledWith({
          where: { moderationStatus: 'visible' },
        });
      });

      it('adds the visible filter to options that carry no where clause', async () => {
        await service.findAll({ take: 5, order: { createdAt: 'DESC' } });

        expect(repo.find).toHaveBeenCalledWith({
          take: 5,
          order: { createdAt: 'DESC' },
          where: { moderationStatus: 'visible' },
        });
      });

      it('merges the visible filter into an existing where clause', async () => {
        await service.findAll({ where: { appScope: 'forgeofwill' } });

        expect(repo.find).toHaveBeenCalledWith({
          where: { appScope: 'forgeofwill', moderationStatus: 'visible' },
        });
      });

      it('keeps an explicitly requested moderation status', async () => {
        await service.findAll({ where: { moderationStatus: 'hidden' } });

        expect(repo.find).toHaveBeenCalledWith({
          where: { moderationStatus: 'hidden' },
        });
      });

      it('applies the filter per entry for an OR-style where array', async () => {
        await service.findAll({
          where: [{ appScope: 'forum' }, { moderationStatus: 'hidden' }],
        });

        expect(repo.find).toHaveBeenCalledWith({
          where: [
            { appScope: 'forum', moderationStatus: 'visible' },
            { moderationStatus: 'hidden' },
          ],
        });
      });

      it('does not mutate the caller supplied options', async () => {
        const options = { where: { appScope: 'forum' } };

        await service.findAll(options);

        expect(options).toEqual({ where: { appScope: 'forum' } });
      });
    });

    describe('moderate', () => {
      it('records the moderation decision and returns the refreshed row', async () => {
        const moderated = { id: 'content-1', moderationStatus: 'hidden' };
        repo.findOne
          .mockResolvedValueOnce({ id: 'content-1' })
          .mockResolvedValueOnce(moderated);

        // Pin the clock so the stored moderatedAt can be asserted exactly.
        jest
          .useFakeTimers()
          .setSystemTime(new Date('2026-02-03T04:05:06.000Z'));
        let result: unknown;
        try {
          result = await service.moderate(
            'content-1',
            'hidden',
            'moderator-1',
            'Repeated spam'
          );
        } finally {
          jest.useRealTimers();
        }

        expect(repo.update).toHaveBeenCalledWith('content-1', {
          moderationStatus: 'hidden',
          moderationNotes: 'Repeated spam',
          moderatedBy: 'moderator-1',
          moderatedAt: new Date('2026-02-03T04:05:06.000Z'),
        });
        expect(result).toBe(moderated);
      });

      it('stores a null note when the moderator supplies none', async () => {
        repo.findOne.mockResolvedValue({ id: 'content-2' });

        await service.moderate('content-2', 'visible', 'moderator-2');

        expect(repo.update).toHaveBeenCalledWith(
          'content-2',
          expect.objectContaining({
            moderationStatus: 'visible',
            moderationNotes: null,
            moderatedBy: 'moderator-2',
          })
        );
      });

      it('rejects moderation of an unknown id without writing', async () => {
        repo.findOne.mockResolvedValue(null);

        await expect(
          service.moderate('missing', 'hidden', 'moderator-3')
        ).rejects.toThrow(notFoundMessage('missing'));
        expect(repo.update).not.toHaveBeenCalled();
      });
    });
  }
);
