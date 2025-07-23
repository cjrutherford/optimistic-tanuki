import path from "path";
import fs from "fs";
import * as yaml from "js-yaml";

export declare type ProjectPlanningConfigType = {
    listenPort: number;
    database: {
        host: string;
        port: number;
        username: string;
        password: string;
        database: string;
    };
}


export const loadConfig = () => {
    const configPath = path.resolve(__dirname, './assets/config.yaml');
    const configFile = fs.readFileSync(configPath, 'utf8');
    const configData = yaml.load(configFile) as ProjectPlanningConfigType;
    return configData;
}