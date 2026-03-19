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

export type LemonSqueezyConfig = {
  apiKey: string;
  storeId: string;
  webhookSecret: string;
  variants: {
    basic: string;
    pro: string;
    enterprise: string;
  };
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
  const finalConfig: PaymentsConfigType = {
    ...yamlConfig,
    lemonSqueezy: {
      ...yamlConfig.lemonSqueezy,
      apiKey:
        process.env.LEMON_SQUEEZY_API_KEY || yamlConfig.lemonSqueezy.apiKey,
    },
  };
  return finalConfig;
};

export default loadConfig;
