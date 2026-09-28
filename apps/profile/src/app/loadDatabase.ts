import { ConfigService } from '@nestjs/config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { Profile } from '../profiles/entities/profile.entity';
import { Timeline } from '../timelines/entities/timeline.entity';
import { Initial1730836292692 } from '../../migrations/1730836292692-initial';
import { AddBlogRole1730838000000 } from '../../migrations/1730838000000-add-blog-role';

const loadDatabase = (config: ConfigService) => {
  const database = config.get('database');
  const entities = [Profile, Timeline];
  const ormConfig: PostgresConnectionOptions = {
    type: 'postgres',
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.database,
    entities,
    migrations: [Initial1730836292692, AddBlogRole1730838000000],
    migrationsRun: process.env.OT_RUN_MIGRATIONS_ON_START === 'true',
  };
  return ormConfig;
};

export default loadDatabase;
