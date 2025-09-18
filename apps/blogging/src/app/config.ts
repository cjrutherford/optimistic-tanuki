import { load } from 'js-yaml';
import { readFileSync } from 'fs';
import { join } from 'path';

export declare type BloggingConfigType = {
    listenPort: number;
    database: {
        host: string;
        port: number;
        username: string;
        password: string;
        database: string;
    }
}

// This function can be expanded to load and parse configuration files as needed.
export default () => {
    return load(readFileSync(join(__dirname, './assets/config.yaml'), 'utf8')) as BloggingConfigType;
}