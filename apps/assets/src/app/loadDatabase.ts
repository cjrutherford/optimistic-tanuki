import { AccountDeletionWriteFenceEntity } from '@optimistic-tanuki/storage';
import { ConfigService } from '@nestjs/config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import AssetEntity from '../entities/asset.entity';
import { GuardianAssetActivity } from '../entities/guardian-asset-activity.entity';

const loadDatabase = (config: ConfigService) => {
  const database = config.get('database');
  const entities = [
    AssetEntity,
    GuardianAssetActivity,
    AccountDeletionWriteFenceEntity,
  ];
  console.log('Database configuration:', {
    host: database.host,
    port: database.port,
    database: database.database || database.name,
  });
  const ormConfig: PostgresConnectionOptions = {
    type: 'postgres',
    host: database.host,
    port: database.port,
    connectTimeoutMS: 3000,
    username: database.username,
    password: database.password,
    database: database.database || database.name,
    entities,
  };
  return ormConfig;
};

export default loadDatabase;
