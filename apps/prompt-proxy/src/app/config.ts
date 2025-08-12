import * as yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

export declare type PromptProxyConfigType = {
    listenPort: number;
    ollama: {
        apiUrl: string;
        apiPort: string;
    }
}

const loadConfig = () => {
    return yaml.load(fs.readFileSync(path.join(__dirname, '../assets/config.yaml'))) as PromptProxyConfigType;
}

export default loadConfig;
