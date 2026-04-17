import { ConfigService } from '@nestjs/config';
import { DailyFourEntity } from './entities/daily-four.entity';
import { DailySixEntity } from './entities/daily-six.entity';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

const loadDatabase = (config: ConfigService) => {
  const database = config.get('database');
  console.log(`Database configuration: ${JSON.stringify(database)}`);
  const entities = [DailyFourEntity, DailySixEntity];
  console.log(
    `Using database configuration: host=${database.host}, port=${database.port}, username=${database.username}, database=${database.database}`
  );
  const ormConfig: PostgresConnectionOptions = {
    type: 'postgres',
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.database || database.name,
    entities,
  };
  return ormConfig;
};

export default loadDatabase;
