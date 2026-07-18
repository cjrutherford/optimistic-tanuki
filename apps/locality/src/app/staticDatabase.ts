import { DataSource } from 'typeorm';
import { LocalityObservationEntity } from '../entities/locality-observation.entity';

const staticSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || '127.0.0.1',
  port: Number(process.env.POSTGRES_PORT || 5432),
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DB || 'ot_locality',
  entities: [LocalityObservationEntity],
  migrations: ['./migrations/*.ts'],
});

export default staticSource;
