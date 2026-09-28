import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import 'pg';

export declare type CivicConfigType = {
  listenPort: number;
  agendaPollIntervalMs?: number;
  agendaSources?: Array<{
    id: string;
    url?: string;
    indexUrl?: string;
    meetingBody?: string;
    tenantId?: string;
    approvedHosts?: string[];
  }>;
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

const loadConfig = (): CivicConfigType => {
  const configPath = path.resolve(__dirname, './assets/config.yaml');
  const configFile = fs.readFileSync(configPath, 'utf8');
  const configData = yaml.load(configFile) as CivicConfigType;
  const databaseName =
    process.env.POSTGRES_DB ||
    configData.database.database ||
    configData.database.name;
  const configuredSources = process.env.CIVIC_AGENDA_SOURCES?.trim()
    ? (JSON.parse(process.env.CIVIC_AGENDA_SOURCES) as NonNullable<
        CivicConfigType['agendaSources']
      >)
    : configData.agendaSources ?? [];
  const defaultTenant = process.env.CIVIC_TENANT_ID?.trim();
  const agendaSources = configuredSources.map((source) => ({
    ...source,
    tenantId: source.tenantId?.trim() || defaultTenant || undefined,
  }));

  return {
    ...configData,
    listenPort: toNumber(
      process.env.LISTEN_PORT,
      configData.listenPort ?? 3026
    ),
    agendaSources,
    agendaPollIntervalMs: toNumber(
      process.env.CIVIC_AGENDA_POLL_INTERVAL_MS,
      configData.agendaPollIntervalMs ?? 6 * 60 * 60 * 1000
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
