import { DataSourceOptions } from 'typeorm';
import { AppConfigurationEntity } from '../configurations/entities/app-configuration.entity';
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
    entities: [AppConfigurationEntity],
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV === 'development',
  };

  return config;
};
