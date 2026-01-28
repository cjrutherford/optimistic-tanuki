import path from 'path';
import fs from 'fs';
import * as yaml from 'js-yaml';
import { TcpClientOptions, Transport } from '@nestjs/microservices';

export type TcpServiceConfig = {
  name:
    | 'authentication'
    | 'profile'
    | 'social'
    | 'tasks'
    | 'project_planning'
    | 'asset'
    | 'chat_collector'
    | 'telos_docs_service';
  transport: Transport;
  options: TcpClientOptions;
  host: string;
  port: number;
};

export type ModelConfig = {
  name: string;
  description?: string;
  temperature?: number;
  pullOnStartup?: boolean;
};

export type ModelConfigs = {
  workflow_control: ModelConfig;
  tool_calling: ModelConfig;
  conversational: ModelConfig;
};

export declare type OrchestratorConfigType = {
  listenPort: number;
  dependencies: { [key: string]: TcpServiceConfig };
  'ai-enabled-services': { [key: string]: string };
  models?: ModelConfigs;
  ollama: {
    host: string;
    port: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
};

export const loadConfig = () => {
  const configPath = path.resolve(__dirname, './assets/config.yaml');
  const configFile = fs.readFileSync(configPath, 'utf8');
  const configData = yaml.load(configFile) as OrchestratorConfigType;

  if (process.env.OLLAMA_HOST) {
    configData.ollama.host = process.env.OLLAMA_HOST;
  }
  if (process.env.OLLAMA_PORT) {
    configData.ollama.port = parseInt(process.env.OLLAMA_PORT, 10);
  }

  return configData;
};
