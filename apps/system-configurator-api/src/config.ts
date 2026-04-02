import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export type SystemConfiguratorApiConfig = {
  listenPort: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  pcpartpicker: {
    baseUrl: string;
    syncOnStart: boolean;
    syncIntervalMs: number;
  };
};

const loadConfig = (): SystemConfiguratorApiConfig => {
  const configPath = path.resolve(__dirname, './assets/config.yaml');
  const configFile = fs.readFileSync(configPath, 'utf8');
  const configData = yaml.load(configFile) as SystemConfiguratorApiConfig;

  return {
    listenPort: parseInt(
      process.env.PORT || String(configData.listenPort),
      10
    ),
    database: {
      host:
        process.env.DB_HOST ||
        process.env.POSTGRES_HOST ||
        configData.database.host,
      port: parseInt(
        process.env.DB_PORT ||
          process.env.POSTGRES_PORT ||
          String(configData.database.port),
        10
      ),
      username:
        process.env.DB_USER ||
        process.env.POSTGRES_USER ||
        configData.database.username,
      password:
        process.env.DB_PASSWORD ||
        process.env.POSTGRES_PASSWORD ||
        configData.database.password,
      database:
        process.env.DB_NAME ||
        process.env.POSTGRES_DB ||
        configData.database.database,
    },
    pcpartpicker: {
      baseUrl:
        process.env.PCPARTPICKER_BASE_URL || configData.pcpartpicker.baseUrl,
      syncOnStart:
        (process.env.PCPARTPICKER_SYNC_ON_START || '').toLowerCase() ===
          'true' || configData.pcpartpicker.syncOnStart,
      syncIntervalMs: parseInt(
        process.env.PCPARTPICKER_SYNC_INTERVAL_MS ||
          String(configData.pcpartpicker.syncIntervalMs),
        10
      ),
    },
  };
};

export default loadConfig;
