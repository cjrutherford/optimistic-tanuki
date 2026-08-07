import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { Topic } from '../../entities/topic.entity';
import { TopicService } from './topic.service';

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
