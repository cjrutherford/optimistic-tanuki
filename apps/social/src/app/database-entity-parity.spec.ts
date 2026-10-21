import 'reflect-metadata';
import { getRepositoryToken } from '@nestjs/typeorm';
import loadDatabase from './loadDatabase';
import staticDatabase from './staticDatabase';
import { AppModule } from './app.module';
import { Activity } from '../entities/activity.entity';
import { Attachment } from '../entities/attachment.entity';
import { BusinessPageContent } from '../entities/business-page-content.entity';
import { BusinessThemeContent } from '../entities/business-theme-content.entity';
import { Comment } from '../entities/comment.entity';
import { CommunityElection } from '../entities/community-election.entity';
import { CommunityInvite } from '../entities/community-invite.entity';
import { CommunityMember } from '../entities/community-member.entity';
import { CommunityMembershipAudit } from '../entities/community-membership-audit.entity';
import { CommunitySponsorshipContent } from '../entities/community-sponsorship-content.entity';
import { Community } from '../entities/community.entity';
import { ContentModerationAction } from '../entities/content-moderation-action.entity';
import { ContentReport } from '../entities/content-report.entity';
import { ElectionCandidate } from '../entities/election-candidate.entity';
import { ElectionVote } from '../entities/election-vote.entity';
import { Event } from '../entities/event.entity';
import FollowEntity from '../entities/Follow.entity';
import { GuardianContentAudit } from '../entities/guardian-content-audit.entity';
import { GuardianPublishedAssetGrant } from '../entities/guardian-published-asset-grant.entity';
import { Link } from '../entities/link.entity';
import { Notification } from '../entities/notification.entity';
import { Poll } from '../entities/poll.entity';
import { PostShare } from '../entities/post-share.entity';
import { Post } from '../entities/post.entity';
import { ProfileView } from '../entities/profile-view.entity';
import { Reaction } from '../entities/reaction.entity';
import { SavedItem } from '../entities/saved-item.entity';
import { SearchHistory } from '../entities/search-history.entity';
import { SocialComponent } from '../entities/social-component.entity';
import { UserBlock } from '../entities/user-block.entity';
import { UserMute } from '../entities/user-mute.entity';
import { UserPresence } from '../entities/user-presence.entity';
import { Vote } from '../entities/vote.entity';
import { DataSource } from 'typeorm';

const EXPECTED_SOCIAL_ENTITIES = [
  Activity,
  Attachment,
  BusinessPageContent,
  BusinessThemeContent,
  Comment,
  Community,
  CommunityElection,
  CommunityInvite,
  CommunityMember,
  CommunityMembershipAudit,
  CommunitySponsorshipContent,
  ContentModerationAction,
  ContentReport,
  ElectionCandidate,
  ElectionVote,
  Event,
  FollowEntity,
  GuardianContentAudit,
  GuardianPublishedAssetGrant,
  Link,
  Notification,
  Poll,
  Post,
  PostShare,
  ProfileView,
  Reaction,
  SavedItem,
  SearchHistory,
  SocialComponent,
  UserBlock,
  UserMute,
  UserPresence,
  Vote,
];

const names = (entities: unknown[]) =>
  entities.map((entity: any) => entity.name).sort();

describe('Social TypeORM entity registration parity', () => {
  it('registers the same complete entity graph in runtime, migrations, and repository providers', async () => {
    const runtimeEntities = (
      loadDatabase({
        get: () => ({
          host: '127.0.0.1',
          port: 5432,
          username: 'test',
          password: 'test',
          database: 'social_test',
        }),
      } as any) as any
    ).entities as unknown[];
    const migrationEntities = staticDatabase.options.entities as unknown[];
    const providers = (Reflect.getMetadata('providers', AppModule) ||
      []) as any[];
    const repositoryProviders = providers
      .filter(
        (provider) =>
          provider && typeof provider === 'object' && 'provide' in provider
      )
      .map((provider) => provider.provide)
      .filter(
        (token) => typeof token === 'string' && token.endsWith('Repository')
      );

    expect(names(runtimeEntities)).toEqual(names(EXPECTED_SOCIAL_ENTITIES));
    expect(names(migrationEntities)).toEqual(names(EXPECTED_SOCIAL_ENTITIES));
    expect(repositoryProviders.sort()).toEqual(
      EXPECTED_SOCIAL_ENTITIES.map((entity) =>
        getRepositoryToken(entity)
      ).sort()
    );

    const source = new DataSource({
      type: 'postgres',
      entities: runtimeEntities as any,
      host: '127.0.0.1',
      port: 5432,
      username: 'test',
      password: 'test',
      database: 'social_test',
    });
    await (source as any).buildMetadatas();
    expect(
      names(source.entityMetadatas.map((metadata) => metadata.target))
    ).toEqual(names(EXPECTED_SOCIAL_ENTITIES));
  });
});
