import path from "path";
import fs from "fs";
import * as yaml from "js-yaml";

export declare type AssetsConfigType = {
    listenPort: number;
    database: {
        host: string;
        port: number;
        username: string;
        password: string;
        database: string;
    };
    storagePath: string;
    assetsUrl: string;
}


export const loadConfig = () => {
    const configPath = path.resolve(__dirname, './assets/config.yaml');
    const configFile = fs.readFileSync(configPath, 'utf8');
    const configData = yaml.load(configFile) as AssetsConfigType;
    return configData;
}