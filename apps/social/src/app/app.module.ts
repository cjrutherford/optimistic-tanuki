import { Module } from '@nestjs/common';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import loadConfig, { TcpServiceConfig } from '../config';
import { DatabaseModule } from '@optimistic-tanuki/database';
import loadDatabase from './loadDatabase';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Post } from '../entities/post.entity';
import { DataSource } from 'typeorm';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { Comment } from '../entities/comment.entity';
import { Vote } from '../entities/vote.entity';
import { Reaction } from '../entities/reaction.entity';
import { Attachment } from '../entities/attachment.entity';
import { Link } from '../entities/link.entity';
import { SocialComponent } from '../entities/social-component.entity';
import { Community } from '../entities/community.entity';
import { CommunityMember } from '../entities/community-member.entity';
import { CommunityInvite } from '../entities/community-invite.entity';
import { CommunityElection } from '../entities/community-election.entity';
import { ElectionCandidate } from '../entities/election-candidate.entity';
import { ElectionVote } from '../entities/election-vote.entity';
import { Notification } from '../entities/notification.entity';
import { VoteService } from './services/vote.service';
import { ReactionService } from './services/reaction.service';
import { PostService } from './services/post.service';
import { LinkService } from './services/link.service';
import { CommentService } from './services/comment.service';
import { AttachmentService } from './services/attachment.service';
import { SocialComponentService } from './services/social-component.service';
import { CommunityService } from './services/community.service';
import FollowEntity from '../entities/Follow.entity';
import FollowService from './services/follow.service';
import { NotificationService } from './services/notification.service';
import { SearchService } from './services/search.service';
import { SearchHistory } from '../entities/search-history.entity';
import { PrivacyService } from './services/privacy.service';
import { UserBlock } from '../entities/user-block.entity';
import { UserMute } from '../entities/user-mute.entity';
import { ContentReport } from '../entities/content-report.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { UserPresence } from '../entities/user-presence.entity';
import { PresenceService } from './services/presence.service';
import { ChatMessageService } from './services/chat-message.service';
import { Activity } from '../entities/activity.entity';
import { SavedItem } from '../entities/saved-item.entity';
import { ActivityService } from './services/activity.service';
import { ProfileView } from '../entities/profile-view.entity';
import { ProfileAnalyticsService } from './services/profile-analytics.service';
import { Poll } from '../entities/poll.entity';
import { PollService } from './services/poll.service';
import { PostShare } from '../entities/post-share.entity';
import { PostShareService } from './services/post-share.service';
import { Event } from '../entities/event.entity';
import { EventService } from './services/event.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    DatabaseModule.register({
      name: 'social',
      factory: loadDatabase,
    }),
  ],
  controllers: [AppController],
  providers: [
    VoteService,
    ReactionService,
    PostService,
    LinkService,
    CommentService,
    AttachmentService,
    FollowService,
    SocialComponentService,
    CommunityService,
    NotificationService,
    SearchService,
    PrivacyService,
    PresenceService,
    ChatMessageService,
    ActivityService,
    ProfileAnalyticsService,
    PollService,
    PostShareService,
    EventService,
    {
      provide: ServiceTokens.PROFILE_SERVICE,
      useFactory: (configService: ConfigService) => {
        const serviceConfig =
          configService.get<TcpServiceConfig>('services.profile');
        return ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host: serviceConfig.host,
            port: serviceConfig.port,
          },
        });
      },
      inject: [ConfigService],
    },
    {
      provide: getRepositoryToken(Post),
      useFactory: (ds: DataSource) => ds.getRepository(Post),
      inject: ['SOCIAL_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Comment),
      useFactory: (ds: DataSource) => ds.getRepository(Comment),
      inject: ['SOCIAL_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Vote),
      useFactory: (ds: DataSource) => ds.getRepository(Vote),
      inject: ['SOCIAL_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Reaction),
      useFactory: (ds: DataSource) => ds.getRepository(Reaction),
      inject: ['SOCIAL_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Attachment),
      useFactory: (ds: DataSource) => ds.getRepository(Attachment),
      inject: ['SOCIAL_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Link),
      useFactory: (ds: DataSource) => ds.getRepository(Link),
      inject: ['SOCIAL_CONNECTION'],
    },
    {
      provide: getRepositoryToken(FollowEntity),
      useFactory: (ds: DataSource) => ds.getRepository(FollowEntity),
      inject: ['SOCIAL_CONNECTION'],
    },
    {
      provide: getRepositoryToken(SocialComponent),
      useFactory: (ds: DataSource) => ds.getRepository(SocialComponent),
      inject: ['SOCIAL_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Community),
      useFactory: (ds: DataSource) => ds.getRepository(Community),
      inject: ['SOCIAL_CONNECTION'],
    },
    {
      provide: getRepositoryToken(CommunityMember),
      useFactory: (ds: DataSource) => ds.getRepository(CommunityMember),
      inject: ['SOCIAL_CONNECTION'],
    },
    {
      provide: getRepositoryToken(CommunityInvite),
      useFactory: (ds: DataSource) => ds.getRepository(CommunityInvite),
      inject: ['SOCIAL_CONNECTION'],
    },
    {
      provide: getRepositoryToken(CommunityElection),
      useFactory: (ds: DataSource) => ds.getRepository(CommunityElection),
      inject: ['SOCIAL_CONNECTION'],
    },
    {
      provide: getRepositoryToken(ElectionCandidate),
      useFactory: (ds: DataSource) => ds.getRepository(ElectionCandidate),
      inject: ['SOCIAL_CONNECTION'],
    },
    {
      provide: getRepositoryToken(ElectionVote),
      useFactory: (ds: DataSource) => ds.getRepository(ElectionVote),
      inject: ['SOCIAL_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Notification),
      useFactory: (ds: DataSource) => ds.getRepository(Notification),
      inject: ['SOCIAL_CONNECTION'],
    },
    {
      provide: getRepositoryToken(SearchHistory),
      useFactory: (ds: DataSource) => ds.getRepository(SearchHistory),
      inject: ['SOCIAL_CONNECTION'],
    },
    {
      provide: getRepositoryToken(UserBlock),
      useFactory: (ds: DataSource) => ds.getRepository(UserBlock),
      inject: ['SOCIAL_CONNECTION'],
    },
    {
      provide: getRepositoryToken(UserMute),
      useFactory: (ds: DataSource) => ds.getRepository(UserMute),
      inject: ['SOCIAL_CONNECTION'],
    },
    {
      provide: getRepositoryToken(ContentReport),
      useFactory: (ds: DataSource) => ds.getRepository(ContentReport),
      inject: ['SOCIAL_CONNECTION'],
    },
    {
      provide: getRepositoryToken(ChatMessage),
      useFactory: (ds: DataSource) => ds.getRepository(ChatMessage),
      inject: ['SOCIAL_CONNECTION'],
    },
    {
      provide: getRepositoryToken(UserPresence),
      useFactory: (ds: DataSource) => ds.getRepository(UserPresence),
      inject: ['SOCIAL_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Activity),
      useFactory: (ds: DataSource) => ds.getRepository(Activity),
      inject: ['SOCIAL_CONNECTION'],
    },
    {
      provide: getRepositoryToken(SavedItem),
      useFactory: (ds: DataSource) => ds.getRepository(SavedItem),
      inject: ['SOCIAL_CONNECTION'],
    },
    {
      provide: getRepositoryToken(ProfileView),
      useFactory: (ds: DataSource) => ds.getRepository(ProfileView),
      inject: ['SOCIAL_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Poll),
      useFactory: (ds: DataSource) => ds.getRepository(Poll),
      inject: ['SOCIAL_CONNECTION'],
    },
    {
      provide: getRepositoryToken(PostShare),
      useFactory: (ds: DataSource) => ds.getRepository(PostShare),
      inject: ['SOCIAL_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Event),
      useFactory: (ds: DataSource) => ds.getRepository(Event),
      inject: ['SOCIAL_CONNECTION'],
    },
  ],
})
export class AppModule {}
