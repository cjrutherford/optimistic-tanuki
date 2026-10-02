import { DataSource } from 'typeorm';
import { COMMUNITY_ENTITIES } from './entities';

export default new DataSource({
  type: 'postgres',
  host: process.env['POSTGRES_HOST'] || 'localhost',
  port: parseInt(process.env['POSTGRES_PORT'] || '5432', 10),
  username: process.env['POSTGRES_USER'] || 'postgres',
  password: process.env['POSTGRES_PASSWORD'] || 'postgres',
  database: process.env['POSTGRES_DB'] || 'ot_civic_contributions',
  entities: COMMUNITY_ENTITIES,
  migrations: ['migrations/*.ts'],
});
