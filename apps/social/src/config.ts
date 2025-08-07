import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Defines the structure for the Social microservice configuration.
 */
export declare type SocialConfigType = {
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
}

/**
 * Loads the configuration for the Social microservice from a YAML file.
 * @returns The loaded configuration data.
 */
const loadConfig = () => {
        const configPath = path.resolve(__dirname, './assets/config.yaml');
        const configFile = fs.readFileSync(configPath, 'utf8');
        return yaml.load(configFile) as SocialConfigType;
};

export default loadConfig;