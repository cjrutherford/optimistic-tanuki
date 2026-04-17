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
    region?: string;
  };
};

export const loadConfig = () => {
  const configPath = path.resolve(__dirname, './assets/config.yaml');
  const configFile = fs.readFileSync(configPath, 'utf8');
  const configData = yaml.load(configFile) as AssetsConfigType;

  const localStoragePath =
    process.env.LOCAL_STORAGE_PATH ||
    configData.storagePath ||
    '/usr/src/app/storage';

  const storageStrategy =
    (process.env.STORAGE_STRATEGY as 'local' | 'network') ||
    configData.storageStrategy ||
    'local';

  const s3Config = process.env.S3_ENDPOINT
    ? {
        endpoint: process.env.S3_ENDPOINT,
        bucket: process.env.S3_BUCKET || 'assets',
        accessKey: process.env.S3_ACCESS_KEY || '',
        secretKey: process.env.S3_SECRET_KEY || '',
        region: process.env.S3_REGION || 'us-east-1',
      }
    : configData.s3;

  const s3Options = s3Config
    ? {
        endpoint: s3Config.endpoint,
        region: s3Config.region || 'us-east-1',
        accessKeyId: s3Config.accessKey,
        secretAccessKey: s3Config.secretKey,
        bucketName: s3Config.bucket,
      }
    : undefined;

  return {
    listenPort: configData.listenPort,
    database: {
      ...configData.database,
      password: process.env.POSTGRES_PASSWORD || configData.database.password,
      username: process.env.POSTGRES_USER || configData.database.username,
    },
    storagePath: localStoragePath,
    storageStrategy,
    s3: s3Config,
    'storage-module-options': {
      enabledAdapters: [storageStrategy],
      localStoragePath,
      ...(s3Options ? { s3Options } : {}),
    },
  };
};
