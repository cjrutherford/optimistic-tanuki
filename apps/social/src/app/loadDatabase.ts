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
import { CommunityMember, CommunityMemberRole } from '../entities/community-member.entity';
import { CommunityInvite } from '../entities/community-invite.entity';

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
    CommunityInvite
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
