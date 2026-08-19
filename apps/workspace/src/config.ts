import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface WorkspaceConfig {
  listenPort: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
}

const loadConfig = (): WorkspaceConfig => {
  const configPath = path.resolve(__dirname, './assets/config.yaml');
  const config = yaml.load(
    fs.readFileSync(configPath, 'utf8')
  ) as WorkspaceConfig;
  return {
    ...config,
    database: {
      ...config.database,
      host: process.env.DATABASE_HOST || config.database.host,
      port: process.env.DATABASE_PORT
        ? Number(process.env.DATABASE_PORT)
        : config.database.port,
      username: process.env.DATABASE_USER || config.database.username,
      password: process.env.DATABASE_PASSWORD || config.database.password,
      database: process.env.DATABASE_NAME || config.database.database,
    },
  };
};

export default loadConfig;
