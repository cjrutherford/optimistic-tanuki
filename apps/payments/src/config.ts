import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import { TcpClientOptions, Transport } from '@nestjs/microservices';

export type TcpServiceConfig = {
  name: 'profile' | 'payments';
  transport: Transport;
  options: TcpClientOptions;
  host: string;
  port: number;
};

export type LemonSqueezyStoreConfig = {
  apiKey: string;
  storeId: string;
};

export type LemonSqueezyConfig = {
  default: LemonSqueezyStoreConfig;
  stores: Record<string, LemonSqueezyStoreConfig>;
};

export type PaymentsConfigType = {
  listenPort: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  services?: {
    profile: TcpServiceConfig;
  };
  lemonSqueezy: LemonSqueezyConfig;
};

const loadConfig = () => {
  const configPath = path.resolve(__dirname, './assets/config.yaml');
  const configFile = fs.readFileSync(configPath, 'utf8');
  const yamlConfig = yaml.load(configFile) as PaymentsConfigType;

  const defaultConfig = yamlConfig.lemonSqueezy?.default || {
    apiKey: '',
    storeId: '',
  };

  const storesConfig = yamlConfig.lemonSqueezy?.stores || {};

  const envOverride = (key: string, defaultValue: string): string => {
    return process.env[key] || defaultValue;
  };

  const finalConfig: PaymentsConfigType = {
    ...yamlConfig,
    lemonSqueezy: {
      default: {
        apiKey: envOverride('LEMON_SQUEEZY_API_KEY', defaultConfig.apiKey),
        storeId: envOverride('LEMON_SQUEEZY_STORE_ID', defaultConfig.storeId),
      },
      stores: storesConfig,
    },
  };

  return finalConfig;
};

export default loadConfig;
