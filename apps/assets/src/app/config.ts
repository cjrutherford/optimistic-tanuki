import path from 'path';
import fs from 'fs';
import * as yaml from 'js-yaml';

export declare type AssetsConfigType = {
  listenPort: number;
  internalMediaPort?: number;
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
  services: Record<string, { host: string; port: number }>;
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
    internalMediaPort: Number(process.env.ASSETS_INTERNAL_MEDIA_PORT || 3006),
    mediaMaxReadBytes: readPositiveInt(
      process.env['ASSETS_MEDIA_MAX_READ_BYTES'],
      1024 * 1024 * 1024
    ),
    internalMediaToken: process.env.ASSETS_INTERNAL_MEDIA_TOKEN,
    services: configData.services,
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

function readPositiveInt(value: string | undefined, fallback: number): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(
      'ASSETS_MEDIA_MAX_READ_BYTES must be a positive safe integer'
    );
  }
  return parsed;
}
