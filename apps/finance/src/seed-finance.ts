import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { AccountService } from './app/services/account.service';
import { TransactionService } from './app/services/transaction.service';
import { InventoryItemService } from './app/services/inventory-item.service';
import { BudgetService } from './app/services/budget.service';
import { RecurringItemService } from './app/services/recurring-item.service';
import { Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  CreateAccountDto,
  CreateBudgetDto,
  CreateInventoryItemDto,
  CreateRecurringItemDto,
  CreateTransactionDto,
} from '@optimistic-tanuki/models';
import { FinanceTenant } from './entities/finance-tenant.entity';
import { FinanceTenantMember } from './entities/finance-tenant-member.entity';
import {
  DEMO_FINANCE_PROFILE_ID,
  DEMO_FINANCE_TENANT_ID,
  ensureDemoFinanceTenant,
} from './seed-finance-support';

async function bootstrap() {
  const logger = new Logger('FinanceSeedScript');
  const app = await NestFactory.createApplicationContext(AppModule);
  let createdTransactionCount = 0;

  try {
    const accountService = app.get(AccountService);
    const transactionService = app.get(TransactionService);
    const inventoryItemService = app.get(InventoryItemService);
    const budgetService = app.get(BudgetService);
    const recurringItemService = app.get(RecurringItemService);
    const tenantRepo = app.get(getRepositoryToken(FinanceTenant));
    const tenantMemberRepo = app.get(getRepositoryToken(FinanceTenantMember));

    logger.log(
      'Seeding finance data with accounts, transactions, inventory, and budgets...'
    );

    // Dummy user IDs for seeding
    const demoUserId = '00000000-0000-0000-0000-000000000001';
    const demoProfileId = DEMO_FINANCE_PROFILE_ID;
    const demoTenantId = DEMO_FINANCE_TENANT_ID;

    await ensureDemoFinanceTenant(tenantRepo, tenantMemberRepo);

    // Create accounts
    const accounts: CreateAccountDto[] = [
      {
        name: 'Primary Checking Account',
        type: 'bank',
        balance: 5432.18,
        currency: 'USD',
        userId: demoUserId,
        profileId: demoProfileId,
        tenantId: demoTenantId,
        appScope: 'finance',
        description: 'Main checking account for daily expenses',
        workspace: 'personal',
        lastReviewedAt: new Date('2026-01-18T10:00:00Z'),
      },
      {
        name: 'High-Yield Savings',
        type: 'bank',
        balance: 15000.0,
        currency: 'USD',
        userId: demoUserId,
        profileId: demoProfileId,
        tenantId: demoTenantId,
        appScope: 'finance',
        description: 'Emergency fund and savings',
        workspace: 'personal',
        lastReviewedAt: new Date('2025-11-15T10:00:00Z'),
      },
      {
        name: 'Credit Card - Rewards',
        type: 'credit',
        balance: -1250.45,
        currency: 'USD',
        userId: demoUserId,
        profileId: demoProfileId,
        tenantId: demoTenantId,
        appScope: 'finance',
        description: 'Cashback rewards credit card',
        workspace: 'personal',
        lastReviewedAt: new Date('2026-01-16T10:00:00Z'),
      },
      {
        name: 'Investment Account',
        type: 'investment',
        balance: 28500.75,
        currency: 'USD',
        userId: demoUserId,
        profileId: demoProfileId,
        tenantId: demoTenantId,
        appScope: 'finance',
        description: 'Long-term investment portfolio',
        workspace: 'personal',
      },
      {
        name: 'Cash Wallet',
        type: 'cash',
        balance: 250.0,
        currency: 'USD',
        userId: demoUserId,
        profileId: demoProfileId,
        tenantId: demoTenantId,
        appScope: 'finance',
        description: 'Physical cash on hand',
        workspace: 'personal',
      },
      {
        name: 'Business Checking',
        type: 'bank',
        balance: 8750.5,
        currency: 'USD',
        userId: demoUserId,
        profileId: demoProfileId,
        tenantId: demoTenantId,
        appScope: 'finance',
        description: 'Small business operating account',
        workspace: 'business',
        lastReviewedAt: new Date('2025-12-01T10:00:00Z'),
      },
    ];

    const createdAccounts: any[] = [];
    for (const accountData of accounts) {
      try {
        const account = await accountService.create(accountData);
        createdAccounts.push(account);
        logger.log(`Created account: ${accountData.name}`);
      } catch (error) {
        logger.warn(
          `Account "${accountData.name}" may already exist: ${error.message}`
        );
      }
    }

    // Create transactions for the checking account
    if (createdAccounts.length > 0) {
      const checkingAccount = createdAccounts.find(
        (a) => a.name === 'Primary Checking Account'
      );
      const savingsAccount = createdAccounts.find(
        (a) => a.name === 'High-Yield Savings'
      );
      const creditAccount = createdAccounts.find(
        (a) => a.name === 'Credit Card - Rewards'
      );
      const businessAccount = createdAccounts.find(
        (a) => a.name === 'Business Checking'
      );

      const transactions: CreateTransactionDto[] = [
        // Checking account transactions
        {
          amount: 3500.0,
          type: 'credit',
          category: 'salary',
          description: 'Monthly salary deposit',
          userId: demoUserId,
          profileId: demoProfileId,
          tenantId: demoTenantId,
          appScope: 'finance',
          accountId: checkingAccount?.id,
          transactionDate: new Date('2026-01-15T08:00:00Z'),
          reference: 'PAYROLL-JAN-2026',
          isRecurring: true,
          workspace: 'personal',
        },
        {
          amount: 1200.0,
          type: 'debit',
          category: 'rent',
          description: 'Monthly rent payment',
          userId: demoUserId,
          profileId: demoProfileId,
          tenantId: demoTenantId,
          appScope: 'finance',
          accountId: checkingAccount?.id,
          transactionDate: new Date('2026-01-01T10:00:00Z'),
          reference: 'RENT-JAN',
          isRecurring: true,
          workspace: 'personal',
        },
        {
          amount: 85.42,
          type: 'debit',
          category: 'groceries',
          description: 'Weekly grocery shopping at Whole Foods',
          userId: demoUserId,
          profileId: demoProfileId,
          tenantId: demoTenantId,
          appScope: 'finance',
          accountId: checkingAccount?.id,
          transactionDate: new Date('2026-01-20T14:30:00Z'),
          isRecurring: false,
          workspace: 'personal',
        },
        {
          amount: 45.0,
          type: 'debit',
          category: 'utilities',
          description: 'Electric bill',
          userId: demoUserId,
          profileId: demoProfileId,
          tenantId: demoTenantId,
          appScope: 'finance',
          accountId: checkingAccount?.id,
          transactionDate: new Date('2026-01-05T09:00:00Z'),
          reference: 'ELEC-JAN',
          isRecurring: true,
          workspace: 'personal',
        },
        {
          amount: 55.0,
          type: 'debit',
          category: 'utilities',
          description: 'Internet service',
          userId: demoUserId,
          profileId: demoProfileId,
          tenantId: demoTenantId,
          appScope: 'finance',
          accountId: checkingAccount?.id,
          transactionDate: new Date('2026-01-03T11:00:00Z'),
          reference: 'ISP-JAN',
          isRecurring: true,
          workspace: 'personal',
        },
        {
          amount: 150.0,
          type: 'debit',
          category: 'insurance',
          description: 'Car insurance premium',
          userId: demoUserId,
          profileId: demoProfileId,
          tenantId: demoTenantId,
          appScope: 'finance',
          accountId: checkingAccount?.id,
          transactionDate: new Date('2026-01-10T08:00:00Z'),
          reference: 'AUTO-INS-JAN',
          isRecurring: true,
          workspace: 'personal',
        },
        {
          amount: 32.5,
          type: 'debit',
          category: 'dining',
          description: 'Lunch at local restaurant',
          userId: demoUserId,
          profileId: demoProfileId,
          tenantId: demoTenantId,
          appScope: 'finance',
          accountId: checkingAccount?.id,
          transactionDate: new Date('2026-01-18T12:15:00Z'),
          isRecurring: false,
          workspace: 'personal',
        },
        {
          amount: 75.0,
          type: 'debit',
          category: 'transportation',
          description: 'Gas station fill-up',
          userId: demoUserId,
          profileId: demoProfileId,
          tenantId: demoTenantId,
          appScope: 'finance',
          accountId: checkingAccount?.id,
          transactionDate: new Date('2026-01-12T17:00:00Z'),
          isRecurring: false,
          workspace: 'personal',
        },

        // Credit card transactions
        {
          amount: 120.0,
          type: 'debit',
          category: 'shopping',
          description: 'Amazon purchase - electronics',
          userId: demoUserId,
          profileId: demoProfileId,
          tenantId: demoTenantId,
          appScope: 'finance',
          accountId: creditAccount?.id,
          transactionDate: new Date('2026-01-08T20:30:00Z'),
          isRecurring: false,
          workspace: 'personal',
        },
        {
          amount: 65.0,
          type: 'debit',
          category: 'entertainment',
          description: 'Movie tickets and snacks',
          userId: demoUserId,
          profileId: demoProfileId,
          tenantId: demoTenantId,
          appScope: 'finance',
          accountId: creditAccount?.id,
          transactionDate: new Date('2026-01-14T19:00:00Z'),
          isRecurring: false,
          workspace: 'personal',
        },
        {
          amount: 15.99,
          type: 'debit',
          category: 'subscriptions',
          description: 'Netflix monthly subscription',
          userId: demoUserId,
          profileId: demoProfileId,
          tenantId: demoTenantId,
          appScope: 'finance',
          accountId: creditAccount?.id,
          transactionDate: new Date('2026-01-01T00:01:00Z'),
          isRecurring: true,
          workspace: 'personal',
        },

        // Savings account transactions
        {
          amount: 500.0,
          type: 'credit',
          category: 'savings',
          description: 'Monthly savings transfer',
          userId: demoUserId,
          profileId: demoProfileId,
          tenantId: demoTenantId,
          appScope: 'finance',
          accountId: savingsAccount?.id,
          transactionDate: new Date('2026-01-15T12:00:00Z'),
          isRecurring: true,
          workspace: 'personal',
        },
        {
          amount: 2.15,
          type: 'credit',
          category: 'interest',
          description: 'Monthly interest payment',
          userId: demoUserId,
          profileId: demoProfileId,
          tenantId: demoTenantId,
          appScope: 'finance',
          accountId: savingsAccount?.id,
          transactionDate: new Date('2026-01-31T23:59:00Z'),
          isRecurring: true,
          workspace: 'personal',
        },

        // Business account transactions
        {
          amount: 2500.0,
          type: 'credit',
          category: 'income',
          description: 'Client payment - Project Alpha',
          userId: demoUserId,
          profileId: demoProfileId,
          tenantId: demoTenantId,
          appScope: 'finance',
          accountId: businessAccount?.id,
          transactionDate: new Date('2026-01-10T14:00:00Z'),
          reference: 'INV-2026-001',
          isRecurring: false,
          workspace: 'business',
        },
        {
          amount: 450.0,
          type: 'debit',
          category: 'business-expense',
          description: 'Software licenses and tools',
          userId: demoUserId,
          profileId: demoProfileId,
          tenantId: demoTenantId,
          appScope: 'finance',
          accountId: businessAccount?.id,
          transactionDate: new Date('2026-01-05T10:00:00Z'),
          isRecurring: false,
          workspace: 'business',
        },
        {
          amount: 200.0,
          type: 'debit',
          category: 'business-expense',
          description: 'Marketing and advertising',
          userId: demoUserId,
          profileId: demoProfileId,
          tenantId: demoTenantId,
          appScope: 'finance',
          accountId: businessAccount?.id,
          transactionDate: new Date('2026-01-12T11:00:00Z'),
          isRecurring: false,
          workspace: 'business',
        },
      ];

      for (const transactionData of transactions) {
        try {
          if (transactionData.accountId) {
            await transactionService.create(transactionData);
            createdTransactionCount += 1;
            logger.log(`Created transaction: ${transactionData.description}`);
          }
        } catch (error) {
          logger.warn(`Could not create transaction: ${error.message}`);
        }
      }
    }

    // Create inventory items
    const inventoryItems: CreateInventoryItemDto[] = [
      {
        name: 'MacBook Pro M3 16"',
        description: 'Laptop computer used for development work',
        quantity: 1,
        unitValue: 3499.0,
        category: 'electronics',
        userId: demoUserId,
        profileId: demoProfileId,
        tenantId: demoTenantId,
        appScope: 'finance',
        sku: 'APPLE-MBP-M3-16',
        location: 'Home Office',
        workspace: 'net-worth',
      },
      {
        name: 'Standing Desk',
        description: 'Electric adjustable height desk',
        quantity: 1,
        unitValue: 650.0,
        category: 'furniture',
        userId: demoUserId,
        profileId: demoProfileId,
        tenantId: demoTenantId,
        appScope: 'finance',
        sku: 'DESK-STAND-01',
        location: 'Home Office',
        workspace: 'net-worth',
      },
      {
        name: 'Herman Miller Aeron Chair',
        description: 'Ergonomic office chair',
        quantity: 1,
        unitValue: 1200.0,
        category: 'furniture',
        userId: demoUserId,
        profileId: demoProfileId,
        tenantId: demoTenantId,
        appScope: 'finance',
        sku: 'CHAIR-HM-AERON',
        location: 'Home Office',
        workspace: 'net-worth',
      },
      {
        name: 'Sony WH-1000XM5 Headphones',
        description: 'Noise-cancelling wireless headphones',
        quantity: 1,
        unitValue: 399.99,
        category: 'electronics',
        userId: demoUserId,
        profileId: demoProfileId,
        tenantId: demoTenantId,
        appScope: 'finance',
        sku: 'SONY-WH1000XM5',
        location: 'Home Office',
        workspace: 'net-worth',
      },
      {
        name: 'LG 27" 4K Monitor',
        description: 'External display for productivity',
        quantity: 2,
        unitValue: 450.0,
        category: 'electronics',
        userId: demoUserId,
        profileId: demoProfileId,
        tenantId: demoTenantId,
        appScope: 'finance',
        sku: 'LG-27UK850',
        location: 'Home Office',
        workspace: 'net-worth',
      },
      {
        name: 'iPhone 15 Pro',
        description: 'Smartphone for communication',
        quantity: 1,
        unitValue: 999.0,
        category: 'electronics',
        userId: demoUserId,
        profileId: demoProfileId,
        tenantId: demoTenantId,
        appScope: 'finance',
        sku: 'APPLE-IP15PRO',
        location: 'Personal',
        workspace: 'net-worth',
      },
      {
        name: 'Vintage Guitar Collection',
        description: 'Collection of 3 vintage guitars',
        quantity: 3,
        unitValue: 1500.0,
        category: 'collectibles',
        userId: demoUserId,
        profileId: demoProfileId,
        tenantId: demoTenantId,
        appScope: 'finance',
        sku: 'GUITAR-VINTAGE',
        location: 'Home',
        workspace: 'net-worth',
      },
      {
        name: 'Camera Equipment',
        description: 'Professional photography gear',
        quantity: 1,
        unitValue: 2200.0,
        category: 'electronics',
        userId: demoUserId,
        profileId: demoProfileId,
        tenantId: demoTenantId,
        appScope: 'finance',
        sku: 'CAM-PROF-KIT',
        location: 'Storage',
        workspace: 'net-worth',
      },
      {
        name: 'Smart Home Hub',
        description: 'Central control for smart home devices',
        quantity: 1,
        unitValue: 150.0,
        category: 'electronics',
        userId: demoUserId,
        profileId: demoProfileId,
        tenantId: demoTenantId,
        appScope: 'finance',
        sku: 'SMARTHUB-01',
        location: 'Living Room',
        workspace: 'net-worth',
      },
      {
        name: 'Library Books Collection',
        description: 'Personal book collection (approx 150 books)',
        quantity: 150,
        unitValue: 15.0,
        category: 'books',
        userId: demoUserId,
        profileId: demoProfileId,
        tenantId: demoTenantId,
        appScope: 'finance',
        sku: 'BOOKS-LIBRARY',
        location: 'Home Library',
        workspace: 'net-worth',
      },
    ];

    for (const itemData of inventoryItems) {
      try {
        await inventoryItemService.create(itemData);
        logger.log(`Created inventory item: ${itemData.name}`);
      } catch (error) {
        logger.warn(`Could not create inventory item: ${error.message}`);
      }
    }

    // Create budgets
    const budgets: CreateBudgetDto[] = [
      {
        name: 'Monthly Groceries Budget',
        category: 'groceries',
        limit: 600.0,
        spent: 85.42,
        period: 'monthly',
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-01-31T23:59:59Z'),
        userId: demoUserId,
        profileId: demoProfileId,
        tenantId: demoTenantId,
        appScope: 'finance',
        alertOnExceed: true,
        workspace: 'personal',
      },
      {
        name: 'Dining Out Budget',
        category: 'dining',
        limit: 300.0,
        spent: 32.5,
        period: 'monthly',
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-01-31T23:59:59Z'),
        userId: demoUserId,
        profileId: demoProfileId,
        tenantId: demoTenantId,
        appScope: 'finance',
        alertOnExceed: true,
        workspace: 'personal',
      },
      {
        name: 'Entertainment Budget',
        category: 'entertainment',
        limit: 200.0,
        spent: 65.0,
        period: 'monthly',
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-01-31T23:59:59Z'),
        userId: demoUserId,
        profileId: demoProfileId,
        tenantId: demoTenantId,
        appScope: 'finance',
        alertOnExceed: true,
        workspace: 'personal',
      },
      {
        name: 'Transportation Budget',
        category: 'transportation',
        limit: 400.0,
        spent: 75.0,
        period: 'monthly',
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-01-31T23:59:59Z'),
        userId: demoUserId,
        profileId: demoProfileId,
        tenantId: demoTenantId,
        appScope: 'finance',
        alertOnExceed: false,
        workspace: 'personal',
      },
      {
        name: 'Shopping Budget',
        category: 'shopping',
        limit: 500.0,
        spent: 120.0,
        period: 'monthly',
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-01-31T23:59:59Z'),
        userId: demoUserId,
        profileId: demoProfileId,
        tenantId: demoTenantId,
        appScope: 'finance',
        alertOnExceed: true,
        workspace: 'personal',
      },
      {
        name: 'Utilities Budget',
        category: 'utilities',
        limit: 250.0,
        spent: 100.0,
        period: 'monthly',
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-01-31T23:59:59Z'),
        userId: demoUserId,
        profileId: demoProfileId,
        tenantId: demoTenantId,
        appScope: 'finance',
        alertOnExceed: true,
        workspace: 'personal',
      },
      {
        name: 'Annual Savings Goal',
        category: 'savings',
        limit: 12000.0,
        spent: 500.0,
        period: 'yearly',
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-12-31T23:59:59Z'),
        userId: demoUserId,
        profileId: demoProfileId,
        tenantId: demoTenantId,
        appScope: 'finance',
        alertOnExceed: false,
        workspace: 'business',
      },
    ];

    for (const budgetData of budgets) {
      try {
        await budgetService.create(budgetData);
        logger.log(`Created budget: ${budgetData.name}`);
      } catch (error) {
        logger.warn(`Could not create budget: ${error.message}`);
      }
    }

    const recurringItems: CreateRecurringItemDto[] = [
      {
        name: 'Rent',
        amount: 1200,
        type: 'debit',
        category: 'rent',
        cadence: 'monthly',
        nextDueDate: new Date('2026-02-01T09:00:00Z'),
        status: 'scheduled',
        payeeOrVendor: 'Landlord',
        workspace: 'personal',
        accountId: createdAccounts.find(
          (account) => account.name === 'Primary Checking Account'
        )?.id,
        userId: demoUserId,
        profileId: demoProfileId,
        tenantId: demoTenantId,
        appScope: 'finance',
      },
      {
        name: 'Payroll Tax Transfer',
        amount: 450,
        type: 'debit',
        category: 'operations',
        cadence: 'monthly',
        nextDueDate: new Date('2026-01-28T12:00:00Z'),
        status: 'scheduled',
        payeeOrVendor: 'Tax savings',
        workspace: 'business',
        accountId: createdAccounts.find(
          (account) => account.name === 'Business Checking'
        )?.id,
        userId: demoUserId,
        profileId: demoProfileId,
        tenantId: demoTenantId,
        appScope: 'finance',
      },
      {
        name: 'Software Renewal Review',
        amount: 99,
        type: 'debit',
        category: 'subscriptions',
        cadence: 'monthly',
        nextDueDate: new Date('2026-01-26T09:00:00Z'),
        status: 'scheduled',
        payeeOrVendor: 'Productivity suite',
        workspace: 'business',
        accountId: createdAccounts.find(
          (account) => account.name === 'Business Checking'
        )?.id,
        userId: demoUserId,
        profileId: demoProfileId,
        tenantId: demoTenantId,
        appScope: 'finance',
      },
    ];

    for (const recurringItemData of recurringItems) {
      try {
        await recurringItemService.create(recurringItemData);
        logger.log(`Created recurring item: ${recurringItemData.name}`);
      } catch (error) {
        logger.warn(`Could not create recurring item: ${error.message}`);
      }
    }

    logger.log('Finance seeding completed successfully!');
    logger.log(`Created ${createdAccounts.length} accounts`);
    logger.log(`Created ${createdTransactionCount} transactions`);
    logger.log(`Created ${inventoryItems.length} inventory items`);
    logger.log(`Created ${budgets.length} budgets`);
    logger.log(`Created ${recurringItems.length} recurring items`);
  } catch (error) {
    logger.error('Error seeding finance data:', error);
    throw error;
  } finally {
    await app.close();
  }
}

bootstrap();
