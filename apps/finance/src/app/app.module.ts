import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import loadConfig from '../config';
import { DatabaseModule } from '@optimistic-tanuki/database';
import loadDatabase from './loadDatabase';
import { getRepositoryToken } from '@nestjs/typeorm';
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
import { DataSource } from 'typeorm';
import { AccountService } from './services/account.service';
import { TransactionService } from './services/transaction.service';
import { InventoryItemService } from './services/inventory-item.service';
import { BudgetService } from './services/budget.service';
import { FinanceSummaryService } from './services/finance-summary.service';
import { RecurringItemService } from './services/recurring-item.service';
import { FinanceTenantService } from './services/finance-tenant.service';
import { BankConnectionService } from './services/bank-connection.service';
import { PlaidBankProviderService } from './services/plaid-bank-provider.service';
import { FinancialUtilitiesService } from './services/financial-utilities.service';
import { FinCommanderPlanService } from './services/fin-commander-plan.service';
import { FinCommanderGoalService } from './services/fin-commander-goal.service';
import { FinCommanderScenarioService } from './services/fin-commander-scenario.service';
import { FinCommanderProjectionService } from './services/fin-commander-projection.service';
import { FinCommanderFundingDirectiveService } from './services/fin-commander-funding-directive.service';
import { VaultEscrowService } from './services/vault-escrow.service';
import { VaultTokenService } from './services/vault-token.service';
import {
  OTP_CHALLENGE_STORE,
  OTP_SMS_DISPATCHER,
  OtpChallengeEntity,
  TimeLockedOtpService,
  TwilioOtpSmsDispatcher,
  TypeOrmOtpChallengeStore,
} from '@optimistic-tanuki/business-security';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    DatabaseModule.register({
      name: 'finance',
      factory: loadDatabase,
    }),
  ],
  controllers: [AppController],
  providers: [
    AccountService,
    TransactionService,
    InventoryItemService,
    BudgetService,
    FinanceSummaryService,
    RecurringItemService,
    FinanceTenantService,
    BankConnectionService,
    PlaidBankProviderService,
    FinancialUtilitiesService,
    FinCommanderPlanService,
    FinCommanderGoalService,
    FinCommanderScenarioService,
    FinCommanderProjectionService,
    FinCommanderFundingDirectiveService,
    {
      provide: OTP_CHALLENGE_STORE,
      useFactory: (ds: DataSource) => new TypeOrmOtpChallengeStore(ds),
      inject: ['FINANCE_CONNECTION'],
    },
    {
      provide: OTP_SMS_DISPATCHER,
      useFactory: (config: ConfigService) => new TwilioOtpSmsDispatcher(config),
      inject: [ConfigService],
    },
    TimeLockedOtpService,
    VaultEscrowService,
    VaultTokenService,
    {
      // The compliance-audit microservice owns the chained SHA-256 ledger, so
      // escrow wire reveals land in the same per-tenant chain as vault uploads.
      provide: ServiceTokens.COMPLIANCE_AUDIT_SERVICE,
      useFactory: () =>
        ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host: process.env.SERVICE_COMPLIANCE_AUDIT_HOST || 'localhost',
            port: parseInt(
              process.env.SERVICE_COMPLIANCE_AUDIT_PORT || '3025',
              10
            ),
          },
        }),
    },
    {
      provide: getRepositoryToken(Account),
      useFactory: (ds: DataSource) => ds.getRepository(Account),
      inject: ['FINANCE_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Transaction),
      useFactory: (ds: DataSource) => ds.getRepository(Transaction),
      inject: ['FINANCE_CONNECTION'],
    },
    {
      provide: getRepositoryToken(InventoryItem),
      useFactory: (ds: DataSource) => ds.getRepository(InventoryItem),
      inject: ['FINANCE_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Budget),
      useFactory: (ds: DataSource) => ds.getRepository(Budget),
      inject: ['FINANCE_CONNECTION'],
    },
    {
      provide: getRepositoryToken(RecurringItem),
      useFactory: (ds: DataSource) => ds.getRepository(RecurringItem),
      inject: ['FINANCE_CONNECTION'],
    },
    {
      provide: getRepositoryToken(FinanceTenant),
      useFactory: (ds: DataSource) => ds.getRepository(FinanceTenant),
      inject: ['FINANCE_CONNECTION'],
    },
    {
      provide: getRepositoryToken(FinanceTenantMember),
      useFactory: (ds: DataSource) => ds.getRepository(FinanceTenantMember),
      inject: ['FINANCE_CONNECTION'],
    },
    {
      provide: getRepositoryToken(BankConnection),
      useFactory: (ds: DataSource) => ds.getRepository(BankConnection),
      inject: ['FINANCE_CONNECTION'],
    },
    {
      provide: getRepositoryToken(LinkedBankAccount),
      useFactory: (ds: DataSource) => ds.getRepository(LinkedBankAccount),
      inject: ['FINANCE_CONNECTION'],
    },
    {
      provide: getRepositoryToken(FinancialInvoice),
      useFactory: (ds: DataSource) => ds.getRepository(FinancialInvoice),
      inject: ['FINANCE_CONNECTION'],
    },
    {
      provide: getRepositoryToken(FinancialCheckoutSession),
      useFactory: (ds: DataSource) =>
        ds.getRepository(FinancialCheckoutSession),
      inject: ['FINANCE_CONNECTION'],
    },
    {
      provide: getRepositoryToken(FinCommanderPlanEntity),
      useFactory: (ds: DataSource) => ds.getRepository(FinCommanderPlanEntity),
      inject: ['FINANCE_CONNECTION'],
    },
    {
      provide: getRepositoryToken(FinCommanderGoalEntity),
      useFactory: (ds: DataSource) => ds.getRepository(FinCommanderGoalEntity),
      inject: ['FINANCE_CONNECTION'],
    },
    {
      provide: getRepositoryToken(FinCommanderScenarioEntity),
      useFactory: (ds: DataSource) =>
        ds.getRepository(FinCommanderScenarioEntity),
      inject: ['FINANCE_CONNECTION'],
    },
    {
      provide: getRepositoryToken(FinCommanderFundingDirectiveEntity),
      useFactory: (ds: DataSource) =>
        ds.getRepository(FinCommanderFundingDirectiveEntity),
      inject: ['FINANCE_CONNECTION'],
    },
    {
      provide: getRepositoryToken(VaultEscrowEntity),
      useFactory: (ds: DataSource) => ds.getRepository(VaultEscrowEntity),
      inject: ['FINANCE_CONNECTION'],
    },
    {
      provide: getRepositoryToken(OtpChallengeEntity),
      useFactory: (ds: DataSource) => ds.getRepository(OtpChallengeEntity),
      inject: ['FINANCE_CONNECTION'],
    },
  ],
})
export class AppModule {}
