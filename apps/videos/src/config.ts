import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

export declare type VideoConfigType = {
  listenPort: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
};

const loadConfig = () => {
  const configPath = path.resolve(__dirname, './assets/config.yaml');
  const configFile = fs.readFileSync(configPath, 'utf8');
  const fileConfig = yaml.load(configFile) as VideoConfigType;
  const finalConfig: VideoConfigType = {
    ...fileConfig,
    listenPort: process.env.PORT
      ? Number.parseInt(process.env.PORT, 10)
      : fileConfig.listenPort,
  };
  console.log('Loaded configuration:', finalConfig);
  return finalConfig;
};

export default loadConfig;
