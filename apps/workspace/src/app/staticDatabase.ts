import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import { DataSource } from 'typeorm';
import { WorkspaceConfig } from '../config';
import { Workspace } from '../entities/workspace.entity';

const config = yaml.load(
  fs.readFileSync(path.resolve(__dirname, '../assets/config.yaml'), 'utf8')
) as WorkspaceConfig;

const staticSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || config.database.host,
  port: Number(process.env.DATABASE_PORT || config.database.port),
  username: process.env.DATABASE_USER || config.database.username,
  password: process.env.DATABASE_PASSWORD || config.database.password,
  database:
    process.env.POSTGRES_DB ||
    process.env.DATABASE_NAME ||
    config.database.database,
  entities: [Workspace],
  migrations: ['./migrations/*.ts'],
});

export default staticSource;
