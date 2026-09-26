import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import 'pg';

export declare type ComplianceAuditConfigType = {
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

const loadConfig = (): ComplianceAuditConfigType => {
  const configPath = path.resolve(__dirname, './assets/config.yaml');
  const configFile = fs.readFileSync(configPath, 'utf8');
  const configData = yaml.load(configFile) as ComplianceAuditConfigType;
  const databaseName =
    process.env.POSTGRES_DB ||
    configData.database.database ||
    configData.database.name;

  return {
    ...configData,
    listenPort: toNumber(
      process.env.LISTEN_PORT,
      configData.listenPort ?? 3025
    ),
    database: {
      ...configData.database,
      host: process.env.POSTGRES_HOST || configData.database.host,
      port: toNumber(process.env.POSTGRES_PORT, configData.database.port),
      database: databaseName,
      name: databaseName,
      password: process.env.POSTGRES_PASSWORD || configData.database.password,
      username: process.env.POSTGRES_USER || configData.database.username,
    },
  };
};

export default loadConfig;
