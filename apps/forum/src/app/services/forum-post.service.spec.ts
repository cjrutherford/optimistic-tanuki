import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForumPost } from '../../entities/forum-post.entity';
import { ForumPostService } from './forum-post.service';

// The workspace maps isomorphic-dompurify to an identity stub, which would make
// "was this value sanitized?" unobservable. A marker implementation makes the
// sanitizer's output visible in what the service hands to the repository.
jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: { sanitize: jest.fn() },
}));

import DOMPurify from 'isomorphic-dompurify';

const sanitize = DOMPurify.sanitize as unknown as jest.Mock;

interface ForumPostRepoMock {
  create: jest.Mock;
  save: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
}

describe('ForumPostService', () => {
  let service: ForumPostService;
  let repo: ForumPostRepoMock;

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
    };

    const module = await Test.createTestingModule({
      providers: [
        ForumPostService,
        { provide: getRepositoryToken(ForumPost), useValue: repo },
      ],
    }).compile();

    service = module.get(ForumPostService);
  });

  describe('create', () => {
    const createDto = {
      content: '<p>Agreed</p><script>alert(1)</script>',
      profileId: 'profile-1',
      userId: 'user-1',
      threadId: 'thread-1',
    };

    it('persists the post with sanitized content', async () => {
      const saved = { id: 'post-1' };
      repo.create.mockReturnValue({ id: 'draft' });
      repo.save.mockResolvedValue(saved);

      await expect(service.create(createDto)).resolves.toBe(saved);

      expect(repo.create).toHaveBeenCalledWith({
        ...createDto,
        content: 'sanitized(<p>Agreed</p><script>alert(1)</script>)',
      });
      expect(repo.save).toHaveBeenCalledWith({ id: 'draft' });
    });

    it('allows rich text markup but only href, target and class attributes', async () => {
      await service.create(createDto);

      expect(sanitize).toHaveBeenCalledWith(
        createDto.content,
        expect.objectContaining({
          ALLOWED_TAGS: expect.arrayContaining(['p', 'a', 'code', 'pre']),
          ALLOWED_ATTR: ['href', 'target', 'class'],
        })
      );
    });
  });

  describe('findOne', () => {
    it('looks the post up behind the visible-only filter', async () => {
      const post = { id: 'post-1' };
      repo.findOne.mockResolvedValue(post);

      await expect(service.findOne('post-1')).resolves.toBe(post);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'post-1', moderationStatus: 'visible' },
      });
    });

    it('forwards caller options alongside the moderation filter', async () => {
      await service.findOne('post-1', { relations: ['links'] });

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'post-1', moderationStatus: 'visible' },
        relations: ['links'],
      });
    });
  });

  describe('update', () => {
    it('marks the post edited and sanitizes the new content', async () => {
      const reloaded = { id: 'post-1', content: 'sanitized(<p>Fixed</p>)' };
      repo.findOne
        .mockResolvedValueOnce({ id: 'post-1', content: 'old' })
        .mockResolvedValueOnce(reloaded);

      await expect(
        service.update('post-1', { content: '<p>Fixed</p>' })
      ).resolves.toBe(reloaded);

      expect(repo.update).toHaveBeenCalledWith('post-1', {
        isEdited: true,
        content: 'sanitized(<p>Fixed</p>)',
      });
    });

    it('still flags the post as edited when no content is supplied', async () => {
      repo.findOne.mockResolvedValue({ id: 'post-1' });

      await service.update('post-1', {});

      expect(repo.update).toHaveBeenCalledWith('post-1', { isEdited: true });
      expect(sanitize).not.toHaveBeenCalled();
    });

    it('ignores blank content rather than storing it', async () => {
      repo.findOne.mockResolvedValue({ id: 'post-1' });

      await service.update('post-1', { content: '' });

      expect(repo.update).toHaveBeenCalledWith('post-1', { isEdited: true });
    });

    it('rejects an unknown post without writing', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update('missing', { content: 'hi' })
      ).rejects.toThrow('Forum post with ID missing not found');
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the post by id', async () => {
      await expect(service.remove('post-1')).resolves.toBeUndefined();

      expect(repo.delete).toHaveBeenCalledWith('post-1');
    });
  });
});
