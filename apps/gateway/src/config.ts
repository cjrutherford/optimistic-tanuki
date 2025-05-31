import { TcpClientOptions, Transport } from '@nestjs/microservices';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import path from 'path';

export type TcpServiceConfig = {
    name: 'authentication' | 'profile' | 'social' | 'tasks';
    transport: Transport;
    options: TcpClientOptions;
    host: string;
    port: number;
}
export type Config = {
    listenPort: number;
    services: {
        authentication: TcpServiceConfig;
        profile: TcpServiceConfig;
        social: TcpServiceConfig;
        tasks: TcpServiceConfig;
    }
};

export const loadConfig = (): Config => {
    const configPath = path.resolve(__dirname, './assets/config.yaml');
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(fileContents) as Config;
    return config;
};
