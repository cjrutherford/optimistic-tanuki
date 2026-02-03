import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import loadConfig from '../config';
import { DatabaseModule } from '@optimistic-tanuki/database';
import loadDatabase from './loadDatabase';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Account } from '../entities/account.entity';
import { Transaction } from '../entities/transaction.entity';
import { InventoryItem } from '../entities/inventory-item.entity';
import { Budget } from '../entities/budget.entity';
import { DataSource } from 'typeorm';
import { AccountService } from './services/account.service';
import { TransactionService } from './services/transaction.service';
import { InventoryItemService } from './services/inventory-item.service';
import { BudgetService } from './services/budget.service';

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
  ],
})
export class AppModule {}
