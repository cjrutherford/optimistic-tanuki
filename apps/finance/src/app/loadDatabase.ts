import { ConfigService } from '@nestjs/config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { Account } from '../entities/account.entity';
import { Transaction } from '../entities/transaction.entity';
import { InventoryItem } from '../entities/inventory-item.entity';
import { Budget } from '../entities/budget.entity';
import { RecurringItem } from '../entities/recurring-item.entity';
import { FinanceTenant } from '../entities/finance-tenant.entity';
import { FinanceTenantMember } from '../entities/finance-tenant-member.entity';
import { BankConnection } from '../entities/bank-connection.entity';
import { LinkedBankAccount } from '../entities/linked-bank-account.entity';
import * as path from 'path';
import { AddFinanceTenantType1760613363000 } from '../migrations/add-finance-tenant-type.migration';
import { BankConnections1771000000000 } from '../migrations/1771000000000-bank-connections';

const loadDatabase = (config: ConfigService) => {
  const database = config.get('database');
  const entities = [
    Account,
    Transaction,
    InventoryItem,
    Budget,
    RecurringItem,
    FinanceTenant,
    FinanceTenantMember,
    BankConnection,
    LinkedBankAccount,
  ];
  const ormConfig: PostgresConnectionOptions = {
    type: 'postgres',
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.database,
    entities,
    migrations: [
      AddFinanceTenantType1760613363000,
      BankConnections1771000000000,
      path.resolve(__dirname, '../migrations/*.js'),
    ],
    migrationsRun: true,
  };
  return ormConfig;
};

export default loadDatabase;
