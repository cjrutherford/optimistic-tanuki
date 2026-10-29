import { AccountDeletionWriteFenceEntity } from '@optimistic-tanuki/storage';
import { ConfigService } from '@nestjs/config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { Conversation, Message } from './entities';

const loadDatabase = (config: ConfigService) => {
  const database = config.get('database');
  const entities = [Message, Conversation, AccountDeletionWriteFenceEntity];
  const ormConfig: PostgresConnectionOptions = {
    type: 'postgres',
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.database || database.name,
    entities,
  };
  return ormConfig;
};

export default loadDatabase;
