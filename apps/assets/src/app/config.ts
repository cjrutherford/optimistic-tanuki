import path from "path";
import fs from "fs";
import * as yaml from "js-yaml";

/**
 * Defines the structure for the Assets microservice configuration.
 */
export declare type AssetsConfigType = {
    /**
     * The port on which the microservice will listen.
     */
    listenPort: number;
    /**
     * Database connection details.
     */
    database: {
        /**
         * The database host.
         */
        host: string;
        /**
         * The database port.
         */
        port: number;
        /**
         * The database username.
         */
        username: string;
        /**
         * The database password.
         */
        password: string;
        /**
         * The database name.
         */
        database: string;
    };
    /**
     * The path where assets will be stored locally.
     */
    storagePath: string;
    /**
     * The base URL for accessing assets.
     */
    assetsUrl: string;
}

/**
 * Loads the configuration for the Assets microservice from a YAML file.
 * @returns The loaded configuration data.
 */
export const loadConfig = () => {
    const configPath = path.resolve(__dirname, './assets/config.yaml');
    const configFile = fs.readFileSync(configPath, 'utf8');
    const configData = yaml.load(configFile) as AssetsConfigType;
    return configData;
}