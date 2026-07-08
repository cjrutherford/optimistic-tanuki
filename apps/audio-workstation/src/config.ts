import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import { TcpClientOptions, Transport } from '@nestjs/microservices';

export type TcpServiceConfig = {
  name: string;
  transport: Transport;
  options: TcpClientOptions;
  host: string;
  port: number;
};

export type AudioWorkstationConfigType = {
  listenPort: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  services?: {
    assets: TcpServiceConfig;
    ai_orchestrator: TcpServiceConfig;
  };
};

const loadConfig = () => {
  const configPath = path.resolve(__dirname, './assets/config.yaml');
  const configFile = fs.readFileSync(configPath, 'utf8');
  const configData = yaml.load(configFile) as AudioWorkstationConfigType;

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

  if (configData.services) {
    if (process.env.SERVICE_ASSETS_HOST) {
      configData.services.assets.host = process.env.SERVICE_ASSETS_HOST;
    }
    if (process.env.SERVICE_ASSETS_PORT) {
      configData.services.assets.port = parseInt(
        process.env.SERVICE_ASSETS_PORT,
        10
      );
    }
    if (process.env.SERVICE_AI_ORCHESTRATOR_HOST) {
      configData.services.ai_orchestrator.host =
        process.env.SERVICE_AI_ORCHESTRATOR_HOST;
    }
    if (process.env.SERVICE_AI_ORCHESTRATOR_PORT) {
      configData.services.ai_orchestrator.port = parseInt(
        process.env.SERVICE_AI_ORCHESTRATOR_PORT,
        10
      );
    }
  }

  return configData;
};

export default loadConfig;
