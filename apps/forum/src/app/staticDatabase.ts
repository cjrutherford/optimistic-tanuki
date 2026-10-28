import { AccountDeletionWriteFenceEntity } from '@optimistic-tanuki/storage';
import { DataSource } from 'typeorm';
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import {
  ForumLink,
  ForumModerationAction,
  ForumPost,
  ForumReport,
  Thread,
  Topic,
} from '../entities';

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
const port = Number(process.env.POSTGRES_PORT || configPort);
const username = process.env.POSTGRES_USER || configUsername;
const password = process.env.POSTGRES_PASSWORD || configPassword;
const host = process.env.POSTGRES_HOST || configHost;
// Use environment variable for database name if available, otherwise use configDatabase or configName
const database = process.env.POSTGRES_DB || configDatabase || configName;

const entities = [
  AccountDeletionWriteFenceEntity,
  ForumLink,
  ForumPost,
  ForumModerationAction,
  ForumReport,
  Thread,
  Topic,
];

const staticSource = new DataSource({
  type: 'postgres',
  host: host,
  port: Number(port),
  username,
  password,
  database: database,
  entities,
  migrations: ['./migrations/*.ts'],
});

export default staticSource;
