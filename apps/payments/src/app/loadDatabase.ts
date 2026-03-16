import { ConfigService } from '@nestjs/config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { Donation } from '../entities/donation.entity';
import { ClassifiedPayment } from '../entities/classified-payment.entity';
import { BusinessPage } from '../entities/business-page.entity';
import { CommunitySponsorship } from '../entities/community-sponsorship.entity';
import { Transaction } from '../entities/transaction.entity';

const loadDatabase = (config: ConfigService) => {
  const database = config.get('database');
  const entities = [
    Donation,
    ClassifiedPayment,
    BusinessPage,
    CommunitySponsorship,
    Transaction,
  ];
  const ormConfig: PostgresConnectionOptions = {
    type: 'postgres',
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.database,
    entities,
  };
  return ormConfig;
};

export default loadDatabase;
