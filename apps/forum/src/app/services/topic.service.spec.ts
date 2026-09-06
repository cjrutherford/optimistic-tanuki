import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { UpdateTopicDto } from '@optimistic-tanuki/models';
import { Topic } from '../../entities/topic.entity';
import { TopicService } from './topic.service';

// The workspace maps isomorphic-dompurify to an identity stub, which would make
// "was this value sanitized?" unobservable. A marker implementation makes the
// sanitizer's output visible in what the service hands to the repository.
jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: { sanitize: jest.fn() },
}));

import DOMPurify from 'isomorphic-dompurify';

const sanitize = DOMPurify.sanitize as unknown as jest.Mock;

describe('TopicService app scoping', () => {
  it('passes the requested app scope to the topic repository', async () => {
    const topicRepo = { find: jest.fn().mockResolvedValue([]) };
    const module = await Test.createTestingModule({
      providers: [
        TopicService,
        { provide: getRepositoryToken(Topic), useValue: topicRepo },
      ],
    }).compile();

    await module.get(TopicService).findAll({
      where: { appScope: 'forgeofwill' },
    });

    expect(topicRepo.find).toHaveBeenCalledWith({
      where: { appScope: 'forgeofwill' },
    });
  });
});

interface TopicRepoMock {
  create: jest.Mock;
  save: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
}

describe('TopicService', () => {
  let service: TopicService;
  let repo: TopicRepoMock;

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
        TopicService,
        { provide: getRepositoryToken(Topic), useValue: repo },
      ],
    }).compile();

    service = module.get(TopicService);
  });

  describe('create', () => {
    const createDto = {
      title: '<b>Announcements</b>',
      description: '<p>Read me</p><script>alert(1)</script>',
      profileId: 'profile-1',
      userId: 'user-1',
    };

    it('persists the topic with a sanitized title and description', async () => {
      const saved = { id: 'topic-1' };
      repo.create.mockReturnValue({ id: 'draft' });
      repo.save.mockResolvedValue(saved);

      await expect(service.create(createDto)).resolves.toBe(saved);

      expect(repo.create).toHaveBeenCalledWith({
        ...createDto,
        title: 'sanitized(<b>Announcements</b>)',
        description: 'sanitized(<p>Read me</p><script>alert(1)</script>)',
      });
      expect(repo.save).toHaveBeenCalledWith({ id: 'draft' });
    });

    it('uses a narrower policy than posts: no code blocks, no class attribute', async () => {
      await service.create(createDto);

      const [, config] = sanitize.mock.calls[0] as [
        string,
        { ALLOWED_TAGS: string[]; ALLOWED_ATTR: string[] }
      ];

      expect(config.ALLOWED_TAGS).toEqual(
        expect.arrayContaining(['p', 'a', 'blockquote'])
      );
      expect(config.ALLOWED_TAGS).not.toContain('code');
      expect(config.ALLOWED_TAGS).not.toContain('pre');
      expect(config.ALLOWED_ATTR).toEqual(['href', 'target']);
    });
  });

  describe('findAll', () => {
    it('queries topics unfiltered when no options are supplied', async () => {
      const rows = [{ id: 'topic-1' }];
      repo.find.mockResolvedValue(rows);

      await expect(service.findAll()).resolves.toBe(rows);
      expect(repo.find).toHaveBeenCalledWith(undefined);
    });
  });

  describe('findOne', () => {
    it('looks the topic up by id', async () => {
      const topic = { id: 'topic-1' };
      repo.findOne.mockResolvedValue(topic);

      await expect(service.findOne('topic-1')).resolves.toBe(topic);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'topic-1' } });
    });

    it('forwards caller options', async () => {
      await service.findOne('topic-1', { relations: ['threads'] });

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'topic-1' },
        relations: ['threads'],
      });
    });
  });

  describe('update', () => {
    const cases: Array<{
      label: string;
      dto: UpdateTopicDto;
      expected: Record<string, unknown>;
    }> = [
      {
        label: 'sanitizes a new title',
        dto: { title: '<b>New</b>' },
        expected: { title: 'sanitized(<b>New</b>)' },
      },
      {
        label: 'sanitizes a new description',
        dto: { description: '<p>Desc</p>' },
        expected: { description: 'sanitized(<p>Desc</p>)' },
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
        label: 'ignores blank title and description',
        dto: { title: '', description: '' },
        expected: {},
      },
      {
        label: 'applies every supplied field at once',
        dto: {
          title: 'T',
          description: 'D',
          visibility: 'public',
          isPinned: true,
          isLocked: false,
        },
        expected: {
          title: 'sanitized(T)',
          description: 'sanitized(D)',
          visibility: 'public',
          isPinned: true,
          isLocked: false,
        },
      },
    ];

    it.each(cases)('$label', async ({ dto, expected }) => {
      repo.findOne.mockResolvedValue({ id: 'topic-1' });

      await service.update('topic-1', dto);

      expect(repo.update).toHaveBeenCalledWith('topic-1', expected);
    });

    it('returns the reloaded topic', async () => {
      const reloaded = { id: 'topic-1', title: 'sanitized(T)' };
      repo.findOne
        .mockResolvedValueOnce({ id: 'topic-1', title: 'old' })
        .mockResolvedValueOnce(reloaded);

      await expect(service.update('topic-1', { title: 'T' })).resolves.toBe(
        reloaded
      );
    });

    it('rejects an unknown topic without writing', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update('missing', { title: 'T' })).rejects.toThrow(
        'Topic with ID missing not found'
      );
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the topic by id', async () => {
      await expect(service.remove('topic-1')).resolves.toBeUndefined();

      expect(repo.delete).toHaveBeenCalledWith('topic-1');
    });
  });
});
