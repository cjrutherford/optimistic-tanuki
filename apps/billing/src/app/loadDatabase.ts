import { ConfigService } from '@nestjs/config';
import {
  BillingAccountEntity,
  UsageBlockGrantEntity,
  UsageEventEntity,
} from '@optimistic-tanuki/billing-data-access';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

const loadDatabase = (configService: ConfigService): PostgresConnectionOptions => {
  const database = configService.get('database');

  return {
    type: 'postgres',
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.database,
    entities: [BillingAccountEntity, UsageEventEntity, UsageBlockGrantEntity],
    synchronize: database.synchronize,
    logging: database.logging,
  };
};

export default loadDatabase;
