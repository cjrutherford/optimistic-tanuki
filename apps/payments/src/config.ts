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
  return yaml.load(configFile) as PaymentsConfigType;
};

export default loadConfig;
