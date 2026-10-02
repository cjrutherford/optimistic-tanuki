import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import 'pg';

export declare type CivicContributionsConfigType = {
  listenPort: number;
  /** Where the local blob store keeps fetched documents (CIVIC_BLOB_DIR). */
  blobDirectory: string;
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

const loadConfig = (): CivicContributionsConfigType => {
  const configPath = path.resolve(__dirname, './assets/config.yaml');
  const configFile = fs.readFileSync(configPath, 'utf8');
  const configData = yaml.load(configFile) as CivicContributionsConfigType;
  const databaseName =
    process.env['POSTGRES_DB'] ||
    configData.database.database ||
    configData.database.name;

  return {
    ...configData,
    blobDirectory:
      process.env['CIVIC_BLOB_DIR'] || `${process.cwd()}/data/blobs`,
    listenPort: toNumber(
      process.env['LISTEN_PORT'],
      configData.listenPort ?? 3029
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

export default loadConfig;
