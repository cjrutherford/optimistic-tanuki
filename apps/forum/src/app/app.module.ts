import { Module } from '@nestjs/common';
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
import { DataSource } from 'typeorm';
import { TopicService } from './services/topic.service';
import { ThreadService } from './services/thread.service';
import { ForumPostService } from './services/forum-post.service';

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
    TopicService,
    ThreadService,
    ForumPostService,
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
  ],
})
export class AppModule {}
