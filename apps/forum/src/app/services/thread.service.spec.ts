import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UpdateThreadDto } from '@optimistic-tanuki/models';
import { Thread } from '../../entities/thread.entity';
import { ForumPost } from '../../entities/forum-post.entity';
import { ThreadService } from './thread.service';

// The workspace maps isomorphic-dompurify to an identity stub, which would make
// "was this value sanitized?" unobservable. A marker implementation makes the
// sanitizer's output visible in what the service hands to the repository.
jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: { sanitize: jest.fn() },
}));

import DOMPurify from 'isomorphic-dompurify';

const sanitize = DOMPurify.sanitize as unknown as jest.Mock;

interface ThreadRepoMock {
  create: jest.Mock;
  save: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  increment: jest.Mock;
}

describe('ThreadService', () => {
  let service: ThreadService;
  let repo: ThreadRepoMock;
  let postRepo: { count: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    sanitize.mockImplementation((content: string) => `sanitized(${content})`);

    repo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      increment: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    postRepo = { count: jest.fn().mockResolvedValue(0) };

    const module = await Test.createTestingModule({
      providers: [
        ThreadService,
        { provide: getRepositoryToken(Thread), useValue: repo },
        { provide: getRepositoryToken(ForumPost), useValue: postRepo },
      ],
    }).compile();

    service = module.get(ThreadService);
  });

  describe('create', () => {
    const createDto = {
      title: '<b>Release plan</b>',
      description: 'Weekly digest',
      content: '<p>Ship it</p><script>alert(1)</script>',
      profileId: 'profile-1',
      userId: 'user-1',
      topicId: 'topic-1',
    };

    it('persists the thread with every rendered field sanitized', async () => {
      const saved = { id: 'thread-1' };
      repo.create.mockReturnValue({ id: 'draft' });
      repo.save.mockResolvedValue(saved);

      await expect(service.create(createDto)).resolves.toBe(saved);

      expect(repo.create).toHaveBeenCalledWith({
        ...createDto,
        title: 'sanitized(<b>Release plan</b>)',
        description: 'sanitized(Weekly digest)',
        content: 'sanitized(<p>Ship it</p><script>alert(1)</script>)',
      });
      expect(repo.save).toHaveBeenCalledWith({ id: 'draft' });
    });

    it('sanitizes a description carrying markup', async () => {
      // description is rendered alongside title and content, so a raw one is
      // a stored-XSS vector even though the DTO spread looks harmless.
      await service.create({
        ...createDto,
        description: '<img src=x onerror=alert(1)>',
      });

      expect(sanitize).toHaveBeenCalledWith(
        '<img src=x onerror=alert(1)>',
        expect.objectContaining({
          ALLOWED_ATTR: ['href', 'target', 'class', 'src', 'alt', 'title'],
          ALLOWED_TAGS: expect.arrayContaining(['img']),
        })
      );
    });

    it('allows rich text and inline images with safe image attributes', async () => {
      await service.create(createDto);

      expect(sanitize).toHaveBeenCalledWith(
        createDto.title,
        expect.objectContaining({
          ALLOWED_TAGS: expect.arrayContaining(['p', 'a', 'code', 'pre']),
          ALLOWED_ATTR: ['href', 'target', 'class', 'src', 'alt', 'title'],
        })
      );
      expect(sanitize).toHaveBeenCalledWith(
        createDto.content,
        expect.objectContaining({
          ALLOWED_ATTR: ['href', 'target', 'class', 'src', 'alt', 'title'],
        })
      );
    });
  });

  describe('findOne', () => {
    it('counts a view when the thread is visible', async () => {
      const thread = {
        id: 'thread-1',
        moderationStatus: 'visible',
        viewCount: 4,
      };
      repo.findOne.mockResolvedValue(thread);

      const result = await service.findOne('thread-1');

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'thread-1', moderationStatus: 'visible' },
      });
      expect(repo.increment).toHaveBeenCalledWith(
        { id: 'thread-1' },
        'viewCount',
        1
      );
      // The in-memory copy is bumped too so callers see the post-increment count.
      expect(result?.viewCount).toBe(5);
    });

    it('forwards caller options alongside the moderation filter', async () => {
      await service.findOne('thread-1', { relations: ['posts'] });

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'thread-1', moderationStatus: 'visible' },
        relations: ['posts'],
      });
    });

    it('does not count a view for a hidden thread', async () => {
      const thread = {
        id: 'thread-1',
        moderationStatus: 'hidden',
        viewCount: 4,
      };
      repo.findOne.mockResolvedValue(thread);

      const result = await service.findOne('thread-1');

      expect(repo.increment).not.toHaveBeenCalled();
      expect(result?.viewCount).toBe(4);
    });

    it('returns null and counts nothing when the thread is missing', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).resolves.toBeNull();
      expect(repo.increment).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const cases: Array<{
      label: string;
      dto: UpdateThreadDto;
      expected: Record<string, unknown>;
    }> = [
      {
        label: 'sanitizes a new title',
        dto: { title: '<b>New</b>' },
        expected: { title: 'sanitized(<b>New</b>)' },
      },
      {
        label: 'sanitizes new content',
        dto: { content: '<p>Body</p>' },
        expected: { content: 'sanitized(<p>Body</p>)' },
      },
      {
        label: 'applies a visibility change',
        dto: { visibility: 'private' },
        expected: { visibility: 'private' },
      },
      {
        label: 'applies unpinning, which is falsy but defined',
        dto: { isPinned: false },
        expected: { isPinned: false },
      },
      {
        label: 'applies locking',
        dto: { isLocked: true },
        expected: { isLocked: true },
      },
      {
        label: 'ignores blank title and content',
        dto: { title: '', content: '' },
        expected: {},
      },
      {
        label: 'applies every supplied field at once',
        dto: {
          title: 'T',
          content: 'C',
          visibility: 'public',
          isPinned: true,
          isLocked: false,
        },
        expected: {
          title: 'sanitized(T)',
          content: 'sanitized(C)',
          visibility: 'public',
          isPinned: true,
          isLocked: false,
        },
      },
    ];

    it.each(cases)('$label', async ({ dto, expected }) => {
      repo.findOne.mockResolvedValue({ id: 'thread-1' });

      await service.update('thread-1', dto);

      expect(repo.update).toHaveBeenCalledWith('thread-1', expected);
    });

    it('returns the reloaded thread', async () => {
      const reloaded = { id: 'thread-1', title: 'sanitized(T)' };
      repo.findOne
        .mockResolvedValueOnce({ id: 'thread-1', title: 'old' })
        .mockResolvedValueOnce(reloaded);

      await expect(service.update('thread-1', { title: 'T' })).resolves.toBe(
        reloaded
      );
    });

    it('rejects an unknown thread without writing', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update('missing', { title: 'T' })).rejects.toThrow(
        'Thread with ID missing not found'
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('rejects when the thread disappears between the write and the reload', async () => {
      repo.findOne
        .mockResolvedValueOnce({ id: 'thread-1' })
        .mockResolvedValueOnce(null);

      await expect(service.update('thread-1', { title: 'T' })).rejects.toThrow(
        'Thread with ID thread-1 not found'
      );
      expect(repo.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('returns conflict without deleting a thread that still has posts', async () => {
      repo.findOne.mockResolvedValue({
        id: 'thread-1',
        title: 'Parent',
        description: 'Parent thread',
        content: 'Parent content',
      });
      postRepo.count.mockResolvedValue(1);

      await expect(service.remove('thread-1')).rejects.toMatchObject({
        error: {
          statusCode: 409,
          message: expect.stringMatching(/post/i),
        },
      });

      expect(postRepo.count).toHaveBeenCalledWith({
        where: { threadId: 'thread-1' },
      });
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('maps a foreign-key race to conflict', async () => {
      repo.findOne.mockResolvedValue({
        id: 'thread-1',
        title: 'Parent',
        description: 'Parent thread',
        content: 'Parent content',
      });
      postRepo.count.mockResolvedValue(0);
      repo.delete.mockRejectedValue({ driverError: { code: '23503' } });

      await expect(service.remove('thread-1')).rejects.toMatchObject({
        error: {
          statusCode: 409,
          message: expect.stringMatching(/post/i),
        },
      });
    });

    it('deletes the thread by id', async () => {
      await expect(service.remove('thread-1')).resolves.toEqual({
        id: 'thread-1',
        deleted: true,
      });

      expect(repo.delete).toHaveBeenCalledWith('thread-1');
    });

    it('returns an explicit negative acknowledgement when no thread was deleted', async () => {
      repo.delete.mockResolvedValue({ affected: 0 });

      await expect(service.remove('thread-1')).resolves.toEqual({
        id: 'thread-1',
        deleted: false,
      });
    });

    it('latches private thread images before dropping their references', async () => {
      const assetId = '123e4567-e89b-42d3-a456-426614174000';
      const access = {
        resolveThreadAudienceOwner: jest.fn().mockResolvedValue('topic-owner'),
        latchAssetReferences: jest.fn().mockResolvedValue(undefined),
      };
      (service as any).forumAccess = access;
      repo.findOne.mockResolvedValue({
        id: 'thread-1',
        topicId: 'topic-1',
        profileId: 'thread-owner',
        visibility: 'public',
        content: `<img src="/api/asset/${assetId}">`,
      });

      await service.remove('thread-1');

      expect(access.resolveThreadAudienceOwner).toHaveBeenCalledWith(
        'topic-1',
        'public',
        'thread-owner'
      );
      expect(access.latchAssetReferences).toHaveBeenCalledWith(
        expect.stringContaining(`/api/asset/${assetId}`),
        'topic-owner'
      );
      expect(
        access.latchAssetReferences.mock.invocationCallOrder[0]
      ).toBeLessThan(repo.delete.mock.invocationCallOrder[0]);
    });
  });
});
