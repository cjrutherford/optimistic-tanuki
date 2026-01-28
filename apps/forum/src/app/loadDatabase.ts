import { ConfigService } from '@nestjs/config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { Topic } from '../entities/topic.entity';
import { Thread } from '../entities/thread.entity';
import { ForumPost } from '../entities/forum-post.entity';
import { ForumLink } from '../entities/forum-link.entity';

const loadDatabase = (config: ConfigService) => {
  const database = config.get('database');
  const entities = [Topic, Thread, ForumPost, ForumLink];
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
