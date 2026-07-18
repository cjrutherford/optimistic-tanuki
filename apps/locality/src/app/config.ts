import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface LocalityConfig {
  listenPort: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
}

export const loadConfig = (): LocalityConfig => {
  const configPath = path.resolve(__dirname, './assets/config.yaml');
  const config = yaml.load(
    fs.readFileSync(configPath, 'utf8')
  ) as LocalityConfig;
  return {
    listenPort: Number(process.env.LOCALITY_PORT || config.listenPort),
    database: {
      ...config.database,
      host:
        process.env.DATABASE_HOST ||
        process.env.POSTGRES_HOST ||
        config.database.host,
      port: Number(
        process.env.DATABASE_PORT ||
          process.env.POSTGRES_PORT ||
          config.database.port
      ),
      username:
        process.env.DATABASE_USER ||
        process.env.POSTGRES_USER ||
        config.database.username,
      password:
        process.env.DATABASE_PASSWORD ||
        process.env.POSTGRES_PASSWORD ||
        config.database.password,
      database:
        process.env.DATABASE_NAME ||
        process.env.POSTGRES_DB ||
        config.database.database,
    },
  };
};
