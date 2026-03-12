import { ConfigService } from '@nestjs/config';
import { ClassifiedAdEntity } from './entities/classified-ad.entity';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

const loadDatabase = (config: ConfigService) => {
  const database = config.get('database');
  const entities = [ClassifiedAdEntity];
  const ormConfig: PostgresConnectionOptions = {
    type: 'postgres',
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.database || database.name,
    entities,
    synchronize: true,
  };
  return ormConfig;
};

export default loadDatabase;
