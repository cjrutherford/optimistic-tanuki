import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Topic } from '../../entities/topic.entity';
import {
  FORUM_PRODUCTION_TOPICS,
  FORUM_SEED_TOPICS,
  ForumSeedTopic,
} from './forum-seed-data';

const DEMO_SEED_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_SEED_PROFILE_ID = '00000000-0000-0000-0000-000000000002';

@Injectable()
export class ForumSeedService implements OnModuleInit {
  private readonly logger = new Logger(ForumSeedService.name);

  constructor(
    @Inject(getRepositoryToken(Topic))
    private readonly topicRepo: Repository<Topic>
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env['SEED_DEMO_DATA'] !== 'true') {
      return;
    }

    await this.seedTopics(FORUM_SEED_TOPICS);
  }

  async seedDemoTopics(): Promise<Topic[]> {
    return await this.seedTopics(FORUM_SEED_TOPICS);
  }

  async seedProductionTopics(): Promise<Topic[]> {
    return await this.seedTopics(FORUM_PRODUCTION_TOPICS);
  }

  private async seedTopics(
    topicsToSeed: readonly ForumSeedTopic[]
  ): Promise<Topic[]> {
    const seededTopics: Topic[] = [];

    for (const seed of topicsToSeed) {
      const existing = await this.topicRepo.findOne({
        where: { appScope: seed.appScope, title: seed.title },
      });

      if (existing) {
        seededTopics.push(existing);
        continue;
      }

      const topic = this.topicRepo.create({
        ...seed,
        userId: DEMO_SEED_USER_ID,
        profileId: DEMO_SEED_PROFILE_ID,
        visibility: 'public',
        isPinned: true,
        isLocked: false,
      });
      seededTopics.push(await this.topicRepo.save(topic));
    }

    this.logger.log(`Ensured ${seededTopics.length} demo forum topics`);
    return seededTopics;
  }
}
