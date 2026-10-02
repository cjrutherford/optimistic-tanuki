import { DataSource } from 'typeorm';
import { FOUNDATION_SCHEMAS } from '@optimistic-tanuki/civic-core';

export default new DataSource({
  type: 'postgres',
  host: process.env['POSTGRES_HOST'] || 'localhost',
  port: parseInt(process.env['POSTGRES_PORT'] || '5432', 10),
  username: process.env['POSTGRES_USER'] || 'postgres',
  password: process.env['POSTGRES_PASSWORD'] || 'postgres',
  database: process.env['POSTGRES_DB'] || 'ot_civic_briefing',
  entities: FOUNDATION_SCHEMAS,
  migrations: ['migrations/*.ts'],
});
