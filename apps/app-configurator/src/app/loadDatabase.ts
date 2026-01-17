import { DataSourceOptions } from 'typeorm';
import { AppConfigurationEntity } from './configurations/entities/app-configuration.entity';

export default (): DataSourceOptions => {
  const config: DataSourceOptions = {
    type: 'postgres',
    host: process.env.DB_HOST || 'db',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'app_configurator',
    entities: [AppConfigurationEntity],
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV === 'development',
  };

  return config;
};
