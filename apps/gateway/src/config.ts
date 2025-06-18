import { TcpClientOptions, Transport } from '@nestjs/microservices';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import path from 'path';

export type ServiceName = 'authentication' | 'profile' | 'social' | 'tasks' | 'asset';

export type TcpServiceConfig = {
    name: ServiceName;
    transport: Transport;
    options?: TcpClientOptions; // Options might not be in YAML, can be constructed
    host: string;
    port: number;
}
export type Config = {
    listenPort: number;
    services: {
        [key in ServiceName]: TcpServiceConfig;
    }
};

const serviceNames: ServiceName[] = ['authentication', 'profile', 'social', 'tasks', 'asset'];

export const loadConfig = (): Config => {
    const configPath = path.resolve(__dirname, './assets/config.yaml');
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const yamlConfig = yaml.load(fileContents) as any; // Load as any to handle structure initially

    const config: Config = {
        listenPort: Number(process.env.LISTEN_PORT) || yamlConfig.listenPort || 3000,
        services: {} as { [key in ServiceName]: TcpServiceConfig }
    };

    for (const serviceName of serviceNames) {
        const yamlService = yamlConfig.services[serviceName];
        if (!yamlService) {
            throw new Error(`Configuration for service ${serviceName} not found in YAML`);
        }

        const envHost = process.env[`${serviceName.toUpperCase()}_SERVICE_HOST`];
        const envPort = process.env[`${serviceName.toUpperCase()}_SERVICE_PORT`];

        config.services[serviceName] = {
            name: serviceName,
            transport: yamlService.transport || Transport.TCP, // Default to TCP if not specified
            host: envHost || yamlService.host,
            port: envPort ? Number(envPort) : yamlService.port,
            // options can be constructed here if needed, e.g., based on host/port
            options: {
                host: envHost || yamlService.host,
                port: envPort ? Number(envPort) : yamlService.port,
                ...(yamlService.options || {}) // Include other options from YAML if they exist
            }
        };
    }
    return config;
};
