import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

export declare type ForumConfigType = {
  listenPort: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
};

const numberOverride = (
  name: string,
  value: string | undefined,
  fallback: number
): number => {
  if (value === undefined) return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name} port override: ${value}`);
  }
  return parsed;
};

const loadConfig = (): ForumConfigType => {
  const configPath = path.resolve(__dirname, './assets/config.yaml');
  const configFile = fs.readFileSync(configPath, 'utf8');
  const config = yaml.load(configFile) as ForumConfigType;

  return {
    ...config,
    listenPort: numberOverride('PORT', process.env.PORT, config.listenPort),
    database: {
      ...config.database,
      host: process.env.POSTGRES_HOST || config.database.host,
      port: numberOverride(
        'POSTGRES_PORT',
        process.env.POSTGRES_PORT,
        config.database.port
      ),
      username: process.env.POSTGRES_USER || config.database.username,
      password: process.env.POSTGRES_PASSWORD || config.database.password,
      database: process.env.POSTGRES_DB || config.database.database,
    },
  };
};

export default loadConfig;
