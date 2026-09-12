import { DataSourceOptions } from 'typeorm';
import { AppConfigurationEntity } from '../configurations/entities/app-configuration.entity';
import { AppInstanceEntity } from '../configurations/entities/app-instance.entity';
import { AppMembershipEntity } from '../configurations/entities/app-membership.entity';
import loadConfig from '../config';

export default (): DataSourceOptions => {
  const appConfig = loadConfig();

  const config: DataSourceOptions = {
    type: 'postgres',
    host: appConfig.database.host,
    port: appConfig.database.port,
    username: appConfig.database.username,
    password: appConfig.database.password,
    database: appConfig.database.database,
    entities: [AppConfigurationEntity, AppInstanceEntity, AppMembershipEntity],
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
  };

  return config;
};
