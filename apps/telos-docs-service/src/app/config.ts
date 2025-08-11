import { ConfigService } from "@nestjs/config";
import path from 'path';
import * as yaml from 'js-yaml';
import { readFileSync } from "fs";

export declare type TelosDocsConfigType = {
    listenPort: number;
    database: {
        host: string;
        port: number;
        username: string;
        password: string;
        database: string;
    };
}

export const loadConfig = (): TelosDocsConfigType => {
    const configPath = path.resolve(__dirname, './assets/config.yaml');
    const configFile = readFileSync(configPath, 'utf8');
    const config = yaml.load(configFile) as TelosDocsConfigType;

    return {
        listenPort: config.listenPort,
        database: {
            host: config.database.host,
            port: config.database.port,
            username: config.database.username,
            password: config.database.password,
            database: config.database.database,
        },
    };
};