import { AccountDeletionWriteFenceEntity } from '@optimistic-tanuki/storage';
import { DataSource } from 'typeorm';
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import { Message, Conversation } from './entities';

const config = yaml.load(
  fs.readFileSync(path.resolve('./src/assets/config.yaml'), 'utf8')
) as Record<string, any>;
const {
  database: {
    host: configHost,
    port: configPort,
    username: configUsername,
    password: configPassword,
    name: configName,
    database: configDatabase,
  },
} = config;
// Use environment variable for host if available, otherwise use configHost
const host = process.env.POSTGRES_HOST || configHost;
// Use environment variable for database name if available, otherwise use configDatabase or configName
const database = process.env.POSTGRES_DB || configDatabase || configName;

const entities = [Message, Conversation, AccountDeletionWriteFenceEntity];

const staticSource = new DataSource({
  type: 'postgres',
  host: host,
  port: Number(process.env.POSTGRES_PORT || configPort),
  username: process.env.POSTGRES_USER || configUsername,
  password: process.env.POSTGRES_PASSWORD || configPassword,
  database: database,
  entities,
  migrations: ['./migrations/*.ts'],
});

export default staticSource;
