import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

export declare type AppConfiguratorConfigType = {
  listenPort: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  redis: {
    host: string;
    port: number;
  };
};

const loadConfig = (): AppConfiguratorConfigType => {
  const configPath = path.resolve(__dirname, './assets/config.yaml');
  const configFile = fs.readFileSync(configPath, 'utf8');
  const configData = yaml.load(configFile) as AppConfiguratorConfigType;
  
  // Allow environment variable overrides
  const config: AppConfiguratorConfigType = {
    listenPort: parseInt(process.env.PORT || String(configData.listenPort), 10),
    database: {
      host: process.env.DB_HOST || configData.database.host,
      port: parseInt(process.env.DB_PORT || String(configData.database.port), 10),
      username: process.env.DB_USER || configData.database.username,
      password: process.env.DB_PASSWORD || configData.database.password,
      database: process.env.DB_NAME || configData.database.database,
    },
    redis: {
      host: process.env.REDIS_HOST || configData.redis.host,
      port: parseInt(process.env.REDIS_PORT || String(configData.redis.port), 10),
    },
  };
  
  console.log('🚀 ~ loadConfig ~ config:', config);
  return config;
};

export default loadConfig;
