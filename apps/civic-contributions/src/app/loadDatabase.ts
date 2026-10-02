import { ConfigService } from '@nestjs/config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { COMMUNITY_ENTITIES } from './entities';

const loadDatabase = (config: ConfigService) => {
  const database = config.get('database');
  const ormConfig: PostgresConnectionOptions = {
    type: 'postgres',
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.database || database.name,
    entities: COMMUNITY_ENTITIES,
  };
  return ormConfig;
};

export default loadDatabase;
