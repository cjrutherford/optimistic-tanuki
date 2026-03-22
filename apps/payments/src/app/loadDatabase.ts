import { ConfigService } from '@nestjs/config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { Donation } from '../entities/donation.entity';
import { ClassifiedPayment } from '../entities/classified-payment.entity';
import { BusinessPage } from '../entities/business-page.entity';
import { BusinessTheme } from '../entities/business-theme.entity';
import { CommunitySponsorship } from '../entities/community-sponsorship.entity';
import { Transaction } from '../entities/transaction.entity';
import { Offer } from '../entities/offer.entity';
import { SellerWallet } from '../entities/seller-wallet.entity';
import { PayoutRequest } from '../entities/payout-request.entity';
import * as path from 'path';

const loadDatabase = (config: ConfigService) => {
  const database = config.get('database');
  const entities = [
    Donation,
    ClassifiedPayment,
    BusinessPage,
    BusinessTheme,
    CommunitySponsorship,
    Transaction,
    Offer,
    SellerWallet,
    PayoutRequest,
  ];
  const ormConfig: PostgresConnectionOptions = {
    type: 'postgres',
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.database,
    entities,
    migrations: [path.resolve(__dirname, '../migrations/*.js')],
    migrationsRun: true,
  };
  return ormConfig;
};

export default loadDatabase;
