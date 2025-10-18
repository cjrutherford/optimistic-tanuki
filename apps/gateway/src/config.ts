import * as fs from 'fs';
import * as yaml from 'js-yaml';

import { TcpClientOptions, Transport } from '@nestjs/microservices';

import path from 'path';

export type TcpServiceConfig = {
    name: 'authentication' | 'profile' | 'social' | 'tasks' | 'project_planning' | 'asset' | 'chat_collector' | 'telos_docs_service' | 'ai_orchestration' | 'blogging';
    transport: Transport;
    options: TcpClientOptions;
    host: string;
    port: number;
}
export type Config = {
    listenPort: number;
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
    }
};

export const loadConfig = (): Config => {
    const configPath = path.resolve(__dirname, './assets/config.yaml');
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(fileContents) as Config;
    return config;
};
