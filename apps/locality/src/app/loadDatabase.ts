import { ConfigService } from '@nestjs/config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { LocalityObservationEntity } from '../entities/locality-observation.entity';
import { LocalityConfig } from './config';

export default (configService: ConfigService): PostgresConnectionOptions => {
  const database = configService.get<LocalityConfig['database']>('database');
  return {
    type: 'postgres',
    host: database?.host,
    port: database?.port,
    username: database?.username,
    password: database?.password,
    database: database?.database,
    entities: [LocalityObservationEntity],
  };
};
