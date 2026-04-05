import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

export declare type ProfileConfigType = {
  listenPort: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  services: {
    permissions: {
      host: string;
      port: number;
    };
  };
};

const loadConfig = () => {
  const configPath = path.resolve(__dirname, './assets/config.yaml');
  const configFile = fs.readFileSync(configPath, 'utf8');
  const configData = yaml.load(configFile) as ProfileConfigType;

  // Support environment variable overrides for database
  if (process.env.DATABASE_HOST) {
    configData.database.host = process.env.DATABASE_HOST;
  }
  if (process.env.DATABASE_PORT) {
    configData.database.port = parseInt(process.env.DATABASE_PORT, 10);
  }
  if (process.env.DATABASE_USER) {
    configData.database.username = process.env.DATABASE_USER;
  }
  if (process.env.DATABASE_PASSWORD) {
    configData.database.password = process.env.DATABASE_PASSWORD;
  }
  if (process.env.DATABASE_NAME) {
    configData.database.database = process.env.DATABASE_NAME;
  }

  // Support environment variable overrides for service hosts
  if (process.env.SERVICE_PERMISSIONS_HOST) {
    configData.services.permissions.host = process.env.SERVICE_PERMISSIONS_HOST;
  }
  if (process.env.SERVICE_PERMISSIONS_PORT) {
    configData.services.permissions.port = parseInt(
      process.env.SERVICE_PERMISSIONS_PORT,
      10
    );
  }

  return configData;
};

export default loadConfig;
