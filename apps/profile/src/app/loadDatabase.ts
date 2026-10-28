import { AccountDeletionWriteFence1792900054691 } from '../../migrations/1792900054691-AccountDeletionWriteFence';
import { AccountDeletionWriteFenceEntity } from '@optimistic-tanuki/storage';
import { ConfigService } from '@nestjs/config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { Profile } from '../profiles/entities/profile.entity';
import { Timeline } from '../timelines/entities/timeline.entity';
import { GuardianProfileActivity } from '../profiles/entities/guardian-profile-activity.entity';
import { Initial1730836292692 } from '../../migrations/1730836292692-initial';
import { AddBlogRole1730838000000 } from '../../migrations/1730838000000-add-blog-role';
import { GuardianProfileActivity1792030280091 } from '../../migrations/1792030280091-guardian-profile-activity';

import { N04AuditErasure1792842249946 } from '../../migrations/1792842249946-N04AuditErasure';

const loadDatabase = (config: ConfigService) => {
  const database = config.get('database');
  const entities = [
    Profile,
    Timeline,
    GuardianProfileActivity,
    AccountDeletionWriteFenceEntity,
  ];
  const ormConfig: PostgresConnectionOptions = {
    type: 'postgres',
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.database,
    entities,
    migrations: [
      Initial1730836292692,
      AddBlogRole1730838000000,
      GuardianProfileActivity1792030280091,
      N04AuditErasure1792842249946,
      AccountDeletionWriteFence1792900054691,
    ],
    migrationsRun: process.env.OT_RUN_MIGRATIONS_ON_START === 'true',
  };
  return ormConfig;
};

export default loadDatabase;
