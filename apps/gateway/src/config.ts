import * as fs from 'fs';
import * as yaml from 'js-yaml';

import { TcpClientOptions, Transport } from '@nestjs/microservices';

import path from 'path';

export type TcpServiceConfig = {
  name:
    | 'authentication'
    | 'profile'
    | 'social'
    | 'tasks'
    | 'project_planning'
    | 'asset'
    | 'chat_collector'
    | 'telos_docs_service'
    | 'ai_orchestration'
    | 'blogging'
    | 'permissions'
    | 'app_configurator';
  transport: Transport;
  options: TcpClientOptions;
  host: string;
  port: number;
};
export type PermissionsCacheConfig = {
  provider: 'memory' | 'file' | 'redis';
  ttl?: number;
  maxSize?: number;
  cacheDir?: string;
  redis?: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
  };
};

export type Config = {
  listenPort: number;
  permissions?: {
    cache?: PermissionsCacheConfig;
  };
  services: {
    asset: TcpServiceConfig;
    authentication: TcpServiceConfig;
    profile: TcpServiceConfig;
    social: TcpServiceConfig;
    tasks: TcpServiceConfig;
    project_planning: TcpServiceConfig;
    chat_collector: TcpServiceConfig;
    telos_docs_service: TcpServiceConfig;
    ai_orchestration: TcpServiceConfig;
    blogging: TcpServiceConfig;
    permissions: TcpServiceConfig;
    app_configurator: TcpServiceConfig;
  };
};

export const loadConfig = (): Config => {
  const configPath = path.resolve(__dirname, './assets/config.yaml');
  const fileContents = fs.readFileSync(configPath, 'utf8');
  const config = yaml.load(fileContents) as Config;

  // Support environment variable overrides
  if (process.env.LISTEN_PORT) {
    config.listenPort = parseInt(process.env.LISTEN_PORT, 10);
  }

  const serviceKeys = Object.keys(config.services) as Array<
    keyof Config['services']
  >;
  serviceKeys.forEach((key) => {
    const envHostKey = `${key.toUpperCase()}_HOST`;
    const envPortKey = `${key.toUpperCase()}_PORT`;

    if (process.env[envHostKey]) {
      config.services[key].host = process.env[envHostKey] as string;
    }

    if (process.env[envPortKey]) {
      const port = parseInt(process.env[envPortKey] as string, 10);
      config.services[key].port = port;
    }
  });

  return config;
};
