import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UpdateThreadDto } from '@optimistic-tanuki/models';
import { Thread } from '../../entities/thread.entity';
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

    const module = await Test.createTestingModule({
      providers: [
        ThreadService,
        { provide: getRepositoryToken(Thread), useValue: repo },
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

    it('persists the thread with a sanitized title and content', async () => {
      const saved = { id: 'thread-1' };
      repo.create.mockReturnValue({ id: 'draft' });
      repo.save.mockResolvedValue(saved);

      await expect(service.create(createDto)).resolves.toBe(saved);

      expect(repo.create).toHaveBeenCalledWith({
        ...createDto,
        title: 'sanitized(<b>Release plan</b>)',
        content: 'sanitized(<p>Ship it</p><script>alert(1)</script>)',
      });
      expect(repo.save).toHaveBeenCalledWith({ id: 'draft' });
    });

    it('allows rich text markup but only href, target and class attributes', async () => {
      await service.create(createDto);

      expect(sanitize).toHaveBeenCalledWith(
        createDto.title,
        expect.objectContaining({
          ALLOWED_TAGS: expect.arrayContaining(['p', 'a', 'code', 'pre']),
          ALLOWED_ATTR: ['href', 'target', 'class'],
        })
      );
      expect(sanitize).toHaveBeenCalledWith(
        createDto.content,
        expect.objectContaining({ ALLOWED_ATTR: ['href', 'target', 'class'] })
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
    it('deletes the thread by id', async () => {
      await expect(service.remove('thread-1')).resolves.toBeUndefined();

      expect(repo.delete).toHaveBeenCalledWith('thread-1');
    });
  });
});
