import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

export declare type PermissionsConfigType = {
  listenPort: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  services: {
    authentication: { host: string; port: number };
    profile: { host: string; port: number };
  };
};

const loadConfig = () => {
  const configPath = path.resolve(__dirname, './assets/config.yaml');
  const configFile = fs.readFileSync(configPath, 'utf8');
  const configData = yaml.load(configFile) as PermissionsConfigType;

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
  if (process.env.LISTEN_PORT) {
    configData.listenPort = parseInt(process.env.LISTEN_PORT, 10);
  }

  configData.services = configData.services ?? {
    authentication: { host: 'authentication', port: 3001 },
    profile: { host: 'profile', port: 3002 },
  };
  configData.services.authentication.host =
    process.env.SERVICE_AUTHENTICATION_HOST ||
    configData.services.authentication.host;
  configData.services.authentication.port = Number(
    process.env.SERVICE_AUTHENTICATION_PORT ||
      configData.services.authentication.port
  );
  configData.services.profile.host =
    process.env.SERVICE_PROFILE_HOST || configData.services.profile.host;
  configData.services.profile.port = Number(
    process.env.SERVICE_PROFILE_PORT || configData.services.profile.port
  );

  return configData;
};

export default loadConfig;
