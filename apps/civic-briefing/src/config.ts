import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import 'pg';

export declare type CivicBriefingConfigType = {
  listenPort: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    name?: string;
    database?: string;
  };
};

const toNumber = (value: string | undefined, fallback: number): number => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const loadConfig = (): CivicBriefingConfigType => {
  const configPath = path.resolve(__dirname, './assets/config.yaml');
  const configFile = fs.readFileSync(configPath, 'utf8');
  const configData = yaml.load(configFile) as CivicBriefingConfigType;
  const databaseName =
    process.env['POSTGRES_DB'] ||
    configData.database.database ||
    configData.database.name;

  return {
    ...configData,
    listenPort: toNumber(
      process.env['LISTEN_PORT'],
      configData.listenPort ?? 3028
    ),
    database: {
      ...configData.database,
      host: process.env['POSTGRES_HOST'] || configData.database.host,
      port: toNumber(process.env['POSTGRES_PORT'], configData.database.port),
      database: databaseName,
      name: databaseName,
      password:
        process.env['POSTGRES_PASSWORD'] || configData.database.password,
      username: process.env['POSTGRES_USER'] || configData.database.username,
    },
  };
};

/** The foundation database as a URL, for helpers that take one. */
export function databaseUrl(config: CivicBriefingConfigType): string {
  const { username, password, host, port, database } = config.database;
  return `postgres://${encodeURIComponent(username)}:${encodeURIComponent(
    password
  )}@${host}:${port}/${database}`;
}

export default loadConfig;
