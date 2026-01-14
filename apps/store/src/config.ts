import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import 'pg';

export declare type StoreConfigType = {
  listenPort: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
};

const loadConfig = () => {
  const configPath = path.resolve(__dirname, './assets/config.yaml');
  const configFile = fs.readFileSync(configPath, 'utf8');
  const configData = yaml.load(configFile) as StoreConfigType;

  // Support environment variable overrides
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

  return configData;
};

export default loadConfig;
