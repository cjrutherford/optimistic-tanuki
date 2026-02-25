import path from 'path';
import fs from 'fs';
import * as yaml from 'js-yaml';

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
  storageStrategy?: 'local' | 'network';
  s3?: {
    endpoint: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
  };
};

export const loadConfig = () => {
  const configPath = path.resolve(__dirname, './assets/config.yaml');
  const configFile = fs.readFileSync(configPath, 'utf8');
  const configData = yaml.load(configFile) as AssetsConfigType;

  return {
    ...configData,
    database: {
      ...configData.database,
      password: process.env.POSTGRES_PASSWORD || configData.database.password,
      username: process.env.POSTGRES_USER || configData.database.username,
    },
    storageStrategy: process.env.STORAGE_STRATEGY || 'local',
    s3: process.env.S3_ENDPOINT
      ? {
          endpoint: process.env.S3_ENDPOINT,
          bucket: process.env.S3_BUCKET || 'assets',
          accessKey: process.env.S3_ACCESS_KEY || '',
          secretKey: process.env.S3_SECRET_KEY || '',
        }
      : undefined,
  };
};
