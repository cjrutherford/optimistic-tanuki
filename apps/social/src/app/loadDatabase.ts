import { ConfigService } from '@nestjs/config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { Attachment } from '../entities/attachment.entity';
import { Post } from '../entities/post.entity';
import { Vote } from '../entities/vote.entity';
import { Link } from '../entities/link.entity';
import { Comment } from '../entities/comment.entity';
import { SocialComponent } from '../entities/social-component.entity';
import FollowEntity from '../entities/Follow.entity';
import { Community } from '../entities/community.entity';
import {
  CommunityMember,
  CommunityMemberRole,
} from '../entities/community-member.entity';
import { CommunityInvite } from '../entities/community-invite.entity';
import { Notification } from '../entities/notification.entity';
import { Reaction } from '../entities/reaction.entity';
import { Activity } from '../entities/activity.entity';
import { SavedItem } from '../entities/saved-item.entity';
import { UserBlock } from '../entities/user-block.entity';
import { UserMute } from '../entities/user-mute.entity';
import { UserPresence } from '../entities/user-presence.entity';
import { ProfileView } from '../entities/profile-view.entity';
import { ContentReport } from '../entities/content-report.entity';
import { ContentModerationAction } from '../entities/content-moderation-action.entity';
import { SearchHistory } from '../entities/search-history.entity';
import { Event } from '../entities/event.entity';
import { BusinessPageContent } from '../entities/business-page-content.entity';
import { BusinessThemeContent } from '../entities/business-theme-content.entity';
import { CommunitySponsorshipContent } from '../entities/community-sponsorship-content.entity';
import { Poll } from '../entities/poll.entity';
import { PostShare } from '../entities/post-share.entity';
import { CommunityMembershipAudit } from '../entities/community-membership-audit.entity';
import { GuardianContentAudit } from '../entities/guardian-content-audit.entity';
import { GuardianPublishedAssetGrant } from '../entities/guardian-published-asset-grant.entity';
import { CommunityElection } from '../entities/community-election.entity';
import { ElectionCandidate } from '../entities/election-candidate.entity';
import { ElectionVote } from '../entities/election-vote.entity';

const loadDatabase = (config: ConfigService) => {
  const database = config.get('database');
  const entities = [
    Attachment,
    Comment,
    Post,
    Vote,
    Link,
    FollowEntity,
    SocialComponent,
    Community,
    CommunityMember,
    CommunityMembershipAudit,
    GuardianContentAudit,
    GuardianPublishedAssetGrant,
    CommunityInvite,
    Notification,
    Reaction,
    Activity,
    SavedItem,
    UserBlock,
    UserMute,
    UserPresence,
    ProfileView,
    ContentReport,
    ContentModerationAction,
    SearchHistory,
    Event,
    BusinessPageContent,
    BusinessThemeContent,
    CommunitySponsorshipContent,
    Poll,
    PostShare,
    CommunityElection,
    ElectionCandidate,
    ElectionVote,
  ];
  const ormConfig: PostgresConnectionOptions = {
    type: 'postgres',
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.database,
    entities,
  };
  return ormConfig;
};

export default loadDatabase;
