import { AccountDeletionWriteFenceEntity } from '@optimistic-tanuki/storage';
import { ConfigService } from '@nestjs/config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { Workspace } from '../entities/workspace.entity';

const loadDatabase = (config: ConfigService): PostgresConnectionOptions => {
  const database = config.get('database');
  return {
    type: 'postgres',
    synchronize: false,
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.database,
    entities: [Workspace, AccountDeletionWriteFenceEntity],
  };
};

export default loadDatabase;
