import { ConfigService } from '@nestjs/config';
import { OtpChallengeEntity } from '@optimistic-tanuki/business-security';
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
import { FinancialInvoice } from '../entities/financial-invoice.entity';
import { FinancialCheckoutSession } from '../entities/financial-checkout-session.entity';
import { FinCommanderPlanEntity } from '../entities/fin-commander-plan.entity';
import { FinCommanderGoalEntity } from '../entities/fin-commander-goal.entity';
import { FinCommanderScenarioEntity } from '../entities/fin-commander-scenario.entity';
import { FinCommanderFundingDirectiveEntity } from '../entities/fin-commander-funding-directive.entity';
import { VaultEscrowEntity } from '../entities/vault-escrow.entity';
import { VaultTokenEntity } from '../entities/vault-token.entity';
import * as path from 'path';
import { AddFinanceTenantType1760613363000 } from '../migrations/1760613363000-add-finance-tenant-type';
import { BankConnections1771000000000 } from '../migrations/1771000000000-bank-connections';
import { FinancialUtilities1771500000000 } from '../migrations/1771500000000-financial-utilities';
import { FinCommander1772000000000 } from '../migrations/1772000000000-fin-commander';
import { FinCommanderFundedGoal1772100000000 } from '../migrations/1772100000000-fin-commander-funded-goal';
import { FinCommanderFundingDirective1772200000000 } from '../migrations/1772200000000-fin-commander-funding-directive';
import { VaultEscrow1790342843391 } from '../migrations/1790342843391-vault-escrow';
import { OtpChallenges1790342980980 } from '../migrations/1790342980980-otp-challenges';

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
    FinancialInvoice,
    FinancialCheckoutSession,
    FinCommanderPlanEntity,
    FinCommanderGoalEntity,
    FinCommanderScenarioEntity,
    FinCommanderFundingDirectiveEntity,
    VaultEscrowEntity,
    VaultTokenEntity,
    OtpChallengeEntity,
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
      FinancialUtilities1771500000000,
      FinCommander1772000000000,
      FinCommanderFundedGoal1772100000000,
      FinCommanderFundingDirective1772200000000,
      VaultEscrow1790342843391,
      OtpChallenges1790342980980,
      path.resolve(__dirname, '../migrations/*.js'),
    ],
    migrationsRun: true,
  };
  return ormConfig;
};

export default loadDatabase;
