import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import { TcpClientOptions, Transport } from '@nestjs/microservices';

export type TcpServiceConfig = {
  name: 'authentication' | 'profile' | 'social';
  transport: Transport;
  options: TcpClientOptions;
  host: string;
  port: number;
};

export type SocialConfigType = {
  listenPort: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  services?: {
    authentication?: TcpServiceConfig;
    profile: TcpServiceConfig;
  };
};

const loadConfig = () => {
  const configPath = path.resolve(__dirname, './assets/config.yaml');
  const configFile = fs.readFileSync(configPath, 'utf8');
  const configData = yaml.load(configFile) as SocialConfigType;

  // Support environment variable overrides for database
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

  // Support environment variable overrides for service hosts
  if (configData.services) {
    if (
      configData.services.authentication &&
      process.env.SERVICE_AUTHENTICATION_HOST
    ) {
      configData.services.authentication.host =
        process.env.SERVICE_AUTHENTICATION_HOST;
    }
    if (
      configData.services.authentication &&
      process.env.SERVICE_AUTHENTICATION_PORT
    ) {
      configData.services.authentication.port = parseInt(
        process.env.SERVICE_AUTHENTICATION_PORT,
        10
      );
    }
    if (process.env.SERVICE_PROFILE_HOST) {
      configData.services.profile.host = process.env.SERVICE_PROFILE_HOST;
    }
    if (process.env.SERVICE_PROFILE_PORT) {
      configData.services.profile.port = parseInt(
        process.env.SERVICE_PROFILE_PORT,
        10
      );
    }
  }

  return configData;
};

export default loadConfig;
