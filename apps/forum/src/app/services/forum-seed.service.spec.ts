import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Topic } from '../../entities/topic.entity';
import { ForumSeedService } from './forum-seed.service';

describe('ForumSeedService', () => {
  const topicRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    topicRepo.findOne.mockResolvedValue(null);
    topicRepo.create.mockImplementation((topic) => topic);
    topicRepo.save.mockImplementation(async (topic) => ({
      id: `${topic.appScope}-${topic.title}`,
      ...topic,
    }));
  });

  it('defines distinct pinned topics for Forge and the client interface', async () => {
    const module = await Test.createTestingModule({
      providers: [
        ForumSeedService,
        { provide: getRepositoryToken(Topic), useValue: topicRepo },
      ],
    }).compile();

    const service = module.get(ForumSeedService);
    const topics = await service.seedDemoTopics();

    expect(topics).toHaveLength(4);
    expect(topics.map((topic) => topic.appScope)).toEqual([
      'client-interface',
      'client-interface',
      'forgeofwill',
      'forgeofwill',
    ]);
    expect(topicRepo.save).toHaveBeenCalledTimes(4);
    expect(topicRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Project Execution',
        appScope: 'forgeofwill',
        visibility: 'public',
        isPinned: true,
      })
    );
  });

  it('is idempotent when the topics already exist', async () => {
    topicRepo.findOne.mockResolvedValue({ id: 'existing-topic' });

    const module = await Test.createTestingModule({
      providers: [
        ForumSeedService,
        { provide: getRepositoryToken(Topic), useValue: topicRepo },
      ],
    }).compile();

    await module.get(ForumSeedService).seedDemoTopics();

    expect(topicRepo.save).not.toHaveBeenCalled();
  });

  it('uses neutral production topics instead of demo copy', async () => {
    const module = await Test.createTestingModule({
      providers: [
        ForumSeedService,
        { provide: getRepositoryToken(Topic), useValue: topicRepo },
      ],
    }).compile();

    const topics = await module.get(ForumSeedService).seedProductionTopics();

    expect(topics.map((topic) => topic.title)).toEqual(
      expect.arrayContaining([
        'Community Conversations',
        'Local Coordination',
        'Project Planning and Execution',
        'Risks and Decisions',
      ])
    );
    expect(topics.map((topic) => topic.title)).not.toContain(
      'Community Introductions'
    );
    expect(topics.map((topic) => topic.title)).not.toContain(
      'Project Execution'
    );
  });
});
