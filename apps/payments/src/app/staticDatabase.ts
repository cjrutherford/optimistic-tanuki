import { AccountDeletionWriteFenceEntity } from '@optimistic-tanuki/storage';
import { DataSource } from 'typeorm';
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import { Donation } from '../entities/donation.entity';
import { ClassifiedPayment } from '../entities/classified-payment.entity';
import { BusinessPage } from '../entities/business-page.entity';
import { BusinessTheme } from '../entities/business-theme.entity';
import { CommunitySponsorship } from '../entities/community-sponsorship.entity';
import { Transaction } from '../entities/transaction.entity';
import { Offer } from '../entities/offer.entity';
import { SellerWallet } from '../entities/seller-wallet.entity';
import { PayoutRequest } from '../entities/payout-request.entity';
import { LemonSqueezyProduct } from '../entities/lemon-squeezy-product.entity';

const config = yaml.load(
  fs.readFileSync(path.resolve(__dirname, '../assets/config.yaml'), 'utf8')
) as Record<string, any>;
const {
  database: {
    host: configHost,
    port: configPort,
    username: configUsername,
    password: configPassword,
    name: configName,
    database: configDatabase,
  },
} = config;

const host = process.env.POSTGRES_HOST || configHost;
const database = process.env.POSTGRES_DB || configDatabase || configName;

const entities = [
  AccountDeletionWriteFenceEntity,
  Donation,
  ClassifiedPayment,
  BusinessPage,
  BusinessTheme,
  CommunitySponsorship,
  Transaction,
  Offer,
  SellerWallet,
  PayoutRequest,
  LemonSqueezyProduct,
];

const staticSource = new DataSource({
  type: 'postgres',
  host: host,
  port: Number(process.env.POSTGRES_PORT || configPort),
  username: process.env.POSTGRES_USER || configUsername,
  password: process.env.POSTGRES_PASSWORD || configPassword,
  database: database,
  entities,
  migrations: ['./migrations/*.ts'],
});
export default staticSource;
