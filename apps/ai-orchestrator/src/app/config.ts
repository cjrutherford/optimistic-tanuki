import path from "path";
import fs from "fs";
import * as yaml from "js-yaml";
import { TcpClientOptions, Transport } from "@nestjs/microservices";

export type TcpServiceConfig = {
    name: 'authentication' | 'profile' | 'social' | 'tasks' | 'project_planning' | 'asset' | 'chat_collector' | 'telos_docs_service';
    transport: Transport;
    options: TcpClientOptions;
    host: string;
    port: number;
}

export declare type OrchestratorConfigType = {
    listenPort: number;
    dependencies: {[key: string]: TcpServiceConfig};
}


export const loadConfig = () => {
    const configPath = path.resolve(__dirname, './assets/config.yaml');
    const configFile = fs.readFileSync(configPath, 'utf8');
    const configData = yaml.load(configFile) as OrchestratorConfigType;
    return configData;
}