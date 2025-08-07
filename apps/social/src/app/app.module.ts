import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import loadConfig from '../config';
import { DatabaseModule } from '@optimistic-tanuki/database';
import loadDatabase from './loadDatabase';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Post } from '../entities/post.entity';
import { DataSource } from 'typeorm';
import { Comment } from '../entities/comment.entity';
import { Vote } from '../entities/vote.entity';
import { Attachment } from '../entities/attachment.entity';
import { Link } from '../entities/link.entity';
import { VoteService } from './services/vote.service';
import { PostService } from './services/post.service';
import { LinkService } from './services/link.service';
import { CommentService } from './services/comment.service';
import { AttachmentService } from './services/attachment.service';
import FollowEntity from '../entities/Follow.entity';
import FollowService from './services/follow.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig]
    }),
    DatabaseModule.register({
      name: 'social',
      factory: loadDatabase,
    }),
  ],
  controllers: [AppController],
  providers: [
    VoteService,
    PostService,
    LinkService,
    CommentService,
    AttachmentService,
    FollowService,
    {
      provide: getRepositoryToken(Post),
      useFactory: (ds: DataSource) => ds.getRepository(Post),
      inject: ['SOCIAL_CONNECTION']
    },{
      provide: getRepositoryToken(Comment),
      useFactory: (ds: DataSource) => ds.getRepository(Comment),
      inject: ['SOCIAL_CONNECTION']
    },{
      provide: getRepositoryToken(Vote),
      useFactory: (ds: DataSource) => ds.getRepository(Vote),
      inject:['SOCIAL_CONNECTION']
    },{
      provide: getRepositoryToken(Attachment),
      useFactory: (ds: DataSource) => ds.getRepository(Attachment),
      inject: ['SOCIAL_CONNECTION']
    },{
      provide: getRepositoryToken(Link),
      useFactory: (ds: DataSource) => ds.getRepository(Link),
      inject: ['SOCIAL_CONNECTION'],
    },{
      provide: getRepositoryToken(FollowEntity),
      useFactory: (ds: DataSource) => ds.getRepository(FollowEntity),
      inject: ['SOCIAL_CONNECTION'],
    }
  ],
})
/**
 * The main application module for the Social microservice.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig]
    }),
    DatabaseModule.register({
      name: 'social',
      factory: loadDatabase,
    })
  ],
  controllers: [AppController],
  providers: [
    VoteService,
    PostService,
    LinkService,
    CommentService,
    AttachmentService,
    FollowService,
    {
      provide: getRepositoryToken(Post),
      useFactory: (ds: DataSource) => ds.getRepository(Post),
      inject: ['SOCIAL_CONNECTION']
    },{
      provide: getRepositoryToken(Comment),
      useFactory: (ds: DataSource) => ds.getRepository(Comment),
      inject: ['SOCIAL_CONNECTION']
    },{
      provide: getRepositoryToken(Vote),
      useFactory: (ds: DataSource) => ds.getRepository(Vote),
      inject:['SOCIAL_CONNECTION']
    },{
      provide: getRepositoryToken(Attachment),
      useFactory: (ds: DataSource) => ds.getRepository(Attachment),
      inject: ['SOCIAL_CONNECTION']
    },{
      provide: getRepositoryToken(Link),
      useFactory: (ds: DataSource) => ds.getRepository(Link),
      inject: ['SOCIAL_CONNECTION'],
    },{
      provide: getRepositoryToken(FollowEntity),
      useFactory: (ds: DataSource) => ds.getRepository(FollowEntity),
      inject: ['SOCIAL_CONNECTION'],
    }
  ],
})
export class AppModule {}
