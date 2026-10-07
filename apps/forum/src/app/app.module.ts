import { ForumAccessService } from './services/forum-access.service';
import { Module } from '@nestjs/common';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import loadConfig from '../config';
import { DatabaseModule } from '@optimistic-tanuki/database';
import loadDatabase from './loadDatabase';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Topic } from '../entities/topic.entity';
import { Thread } from '../entities/thread.entity';
import { ForumPost } from '../entities/forum-post.entity';
import { ForumLink } from '../entities/forum-link.entity';
import { ForumReport } from '../entities/forum-report.entity';
import { DataSource } from 'typeorm';
import { TopicService } from './services/topic.service';
import { ThreadService } from './services/thread.service';
import { ForumPostService } from './services/forum-post.service';
import { ForumModerationService } from './services/forum-moderation.service';
import { ForumSeedService } from './services/forum-seed.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    DatabaseModule.register({
      name: 'forum',
      factory: loadDatabase,
    }),
  ],
  controllers: [AppController],
  providers: [
    {
      provide: ServiceTokens.ASSETS_SERVICE,
      useFactory: () =>
        ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host: process.env.SERVICE_ASSETS_HOST || 'assets',
            port: Number(process.env.SERVICE_ASSETS_PORT || 3005),
          },
        }),
    },
    ForumAccessService,
    TopicService,
    ThreadService,
    ForumPostService,
    ForumModerationService,
    ForumSeedService,
    {
      provide: getRepositoryToken(Topic),
      useFactory: (ds: DataSource) => ds.getRepository(Topic),
      inject: ['FORUM_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Thread),
      useFactory: (ds: DataSource) => ds.getRepository(Thread),
      inject: ['FORUM_CONNECTION'],
    },
    {
      provide: getRepositoryToken(ForumPost),
      useFactory: (ds: DataSource) => ds.getRepository(ForumPost),
      inject: ['FORUM_CONNECTION'],
    },
    {
      provide: getRepositoryToken(ForumLink),
      useFactory: (ds: DataSource) => ds.getRepository(ForumLink),
      inject: ['FORUM_CONNECTION'],
    },
    {
      provide: getRepositoryToken(ForumReport),
      useFactory: (ds: DataSource) => ds.getRepository(ForumReport),
      inject: ['FORUM_CONNECTION'],
    },
  ],
})
export class AppModule {}
