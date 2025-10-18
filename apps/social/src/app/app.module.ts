import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import loadConfig from '../config';
import { DatabaseModule } from '@optimistic-tanuki/database';
import loadDatabase from './loadDatabase';
import { VoteService } from './services/vote.service';
import { PostService } from './services/post.service';
import { LinkService } from './services/link.service';
import { CommentService } from './services/comment.service';
import { AttachmentService } from './services/attachment.service';
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
  ],
})
export class AppModule {}
