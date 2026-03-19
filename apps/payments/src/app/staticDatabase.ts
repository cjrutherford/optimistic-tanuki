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

const config = yaml.load(
  fs.readFileSync(path.resolve(__dirname, '../assets/config.yaml'), 'utf8')
) as Record<string, any>;
const {
  database: {
    host: configHost,
    port,
    username,
    password,
    name: configName,
    database: configDatabase,
  },
} = config;

const host = process.env.POSTGRES_HOST || configHost;
const database = process.env.POSTGRES_DB || configDatabase || configName;

const entities = [
  Donation,
  ClassifiedPayment,
  BusinessPage,
  BusinessTheme,
  CommunitySponsorship,
  Transaction,
  Offer,
];

const staticSource = new DataSource({
  type: 'postgres',
  host: host,
  port: Number(port),
  username,
  password,
  database: database,
  entities,
  migrations: [path.resolve(__dirname, '../../src/migrations/*.js')],
});
export default staticSource;
