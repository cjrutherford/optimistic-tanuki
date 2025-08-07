import * as fs from 'fs';
import * as yaml from 'js-yaml';

import { TcpClientOptions, Transport } from '@nestjs/microservices';

import path from 'path';

/**
 * Represents the configuration for a TCP microservice.
 */
export type TcpServiceConfig = {
    /**
     * The name of the service.
     */
    name: 'authentication' | 'profile' | 'social' | 'tasks' | 'project_planning' | 'asset' | 'chat_collector';
    /**
     * The transport layer used by the service.
     */
    transport: Transport;
    /**
     * Options for the TCP client.
     */
    options: TcpClientOptions;
    /**
     * The host of the service.
     */
    host: string;
    /**
     * The port of the service.
     */
    port: number;
}

/**
 * Represents the overall configuration for the Gateway microservice.
 */
export type Config = {
    /**
     * The port on which the gateway will listen.
     */
    listenPort: number;
    /**
     * Configuration for various microservices.
     */
    services: {
        asset: TcpServiceConfig;
        authentication: TcpServiceConfig;
        profile: TcpServiceConfig;
        social: TcpServiceConfig;
        tasks: TcpServiceConfig;
        project_planning: TcpServiceConfig;
        chat_collector: TcpServiceConfig;
    }
};

/**
 * Loads the configuration for the Gateway microservice from a YAML file.
 * @returns The loaded configuration data.
 */
export const loadConfig = (): Config => {
    const configPath = path.resolve(__dirname, './assets/config.yaml');
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(fileContents) as Config;
    return config;
};
