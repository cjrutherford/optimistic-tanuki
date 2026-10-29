import { ConfigService } from '@nestjs/config';
import { AccountDeletionWriteFenceEntity } from '@optimistic-tanuki/storage';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { AppConfigurationEntity } from '../configurations/entities/app-configuration.entity';
import { AppInstanceEntity } from '../configurations/entities/app-instance.entity';
import { AppMembershipEntity } from '../configurations/entities/app-membership.entity';
import loadConfig from '../config';

export default (
  configured?: Pick<ConfigService, 'get'>
): PostgresConnectionOptions => {
  const appConfig =
    configured && typeof configured.get === 'function'
      ? { database: configured.get('database') }
      : loadConfig();

  const config: PostgresConnectionOptions = {
    type: 'postgres',
    host: appConfig.database.host,
    port: appConfig.database.port,
    username: appConfig.database.username,
    password: appConfig.database.password,
    database: appConfig.database.database,
    entities: [
      AppConfigurationEntity,
      AppInstanceEntity,
      AppMembershipEntity,
      AccountDeletionWriteFenceEntity,
    ],
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
  };

  return config;
};
