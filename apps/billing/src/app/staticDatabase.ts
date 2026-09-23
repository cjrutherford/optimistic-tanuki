import { DataSource } from 'typeorm';
import {
  BillingAccountEntity,
  BillingInvoiceEntity,
  BillingSubscriptionEntity,
  StoreProductPlanEntity,
  UsageBlockGrantEntity,
  UsageEventEntity,
} from '@optimistic-tanuki/billing-data-access';

// Static DataSource for the TypeORM CLI (migration:generate/run/revert).
// Connection values follow `apps/billing/src/config.ts` (BILLING_DB_* first,
// then shared DB_* fallbacks), plus the POSTGRES_* variables the
// db-setup loop exports — billing owns its schema; nothing shares it (E3–E7).
const staticSource = new DataSource({
  type: 'postgres',
  host:
    process.env['BILLING_DB_HOST'] ||
    process.env['POSTGRES_HOST'] ||
    process.env['DB_HOST'] ||
    'localhost',
  port: Number(
    process.env['BILLING_DB_PORT'] ||
      process.env['POSTGRES_PORT'] ||
      process.env['DB_PORT'] ||
      5432
  ),
  username:
    process.env['BILLING_DB_USERNAME'] ||
    process.env['POSTGRES_USER'] ||
    process.env['DB_USERNAME'] ||
    'postgres',
  password:
    process.env['BILLING_DB_PASSWORD'] ||
    process.env['POSTGRES_PASSWORD'] ||
    process.env['DB_PASSWORD'] ||
    'postgres',
  database:
    process.env['BILLING_DB_NAME'] ||
    process.env['POSTGRES_DB'] ||
    process.env['DB_NAME'] ||
    'ot_billing',
  entities: [
    BillingAccountEntity,
    UsageBlockGrantEntity,
    UsageEventEntity,
    BillingInvoiceEntity,
    BillingSubscriptionEntity,
    StoreProductPlanEntity,
  ],
  migrations: ['./migrations/*.ts'],
});
export default staticSource;
