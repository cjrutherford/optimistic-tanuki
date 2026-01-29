import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { AccountService } from './app/services/account.service';
import { TransactionService } from './app/services/transaction.service';
import { InventoryItemService } from './app/services/inventory-item.service';
import { BudgetService } from './app/services/budget.service';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('FinanceSeedScript');
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const accountService = app.get(AccountService);
    const transactionService = app.get(TransactionService);
    const inventoryItemService = app.get(InventoryItemService);
    const budgetService = app.get(BudgetService);

    logger.log('Seeding finance data with accounts, transactions, inventory, and budgets...');

    // Dummy user IDs for seeding
    const demoUserId = '00000000-0000-0000-0000-000000000001';
    const demoProfileId = '00000000-0000-0000-0000-000000000001';

    // Create accounts
    const accounts = [
      {
        name: 'Primary Checking Account',
        type: 'bank',
        balance: 5432.18,
        currency: 'USD',
        userId: demoUserId,
        profileId: demoProfileId,
        appScope: 'finance',
        description: 'Main checking account for daily expenses',
      },
      {
        name: 'High-Yield Savings',
        type: 'bank',
        balance: 15000.00,
        currency: 'USD',
        userId: demoUserId,
        profileId: demoProfileId,
        appScope: 'finance',
        description: 'Emergency fund and savings',
      },
      {
        name: 'Credit Card - Rewards',
        type: 'credit',
        balance: -1250.45,
        currency: 'USD',
        userId: demoUserId,
        profileId: demoProfileId,
        appScope: 'finance',
        description: 'Cashback rewards credit card',
      },
      {
        name: 'Investment Account',
        type: 'investment',
        balance: 28500.75,
        currency: 'USD',
        userId: demoUserId,
        profileId: demoProfileId,
        appScope: 'finance',
        description: 'Long-term investment portfolio',
      },
      {
        name: 'Cash Wallet',
        type: 'cash',
        balance: 250.00,
        currency: 'USD',
        userId: demoUserId,
        profileId: demoProfileId,
        appScope: 'finance',
        description: 'Physical cash on hand',
      },
      {
        name: 'Business Checking',
        type: 'bank',
        balance: 8750.50,
        currency: 'USD',
        userId: demoUserId,
        profileId: demoProfileId,
        appScope: 'finance',
        description: 'Small business operating account',
      },
    ];

    const createdAccounts: any[] = [];
    for (const accountData of accounts) {
      try {
        const account = await accountService.create(accountData);
        createdAccounts.push(account);
        logger.log(`Created account: ${accountData.name}`);
      } catch (error) {
        logger.warn(`Account "${accountData.name}" may already exist: ${error.message}`);
      }
    }

    // Create transactions for the checking account
    if (createdAccounts.length > 0) {
      const checkingAccount = createdAccounts.find(a => a.name === 'Primary Checking Account');
      const savingsAccount = createdAccounts.find(a => a.name === 'High-Yield Savings');
      const creditAccount = createdAccounts.find(a => a.name === 'Credit Card - Rewards');
      const businessAccount = createdAccounts.find(a => a.name === 'Business Checking');

      const transactions = [
        // Checking account transactions
        {
          amount: 3500.00,
          type: 'credit',
          category: 'salary',
          description: 'Monthly salary deposit',
          userId: demoUserId,
          profileId: demoProfileId,
          appScope: 'finance',
          accountId: checkingAccount?.id,
          transactionDate: new Date('2026-01-15T08:00:00Z'),
          reference: 'PAYROLL-JAN-2026',
          isRecurring: true,
        },
        {
          amount: 1200.00,
          type: 'debit',
          category: 'rent',
          description: 'Monthly rent payment',
          userId: demoUserId,
          profileId: demoProfileId,
          appScope: 'finance',
          accountId: checkingAccount?.id,
          transactionDate: new Date('2026-01-01T10:00:00Z'),
          reference: 'RENT-JAN',
          isRecurring: true,
        },
        {
          amount: 85.42,
          type: 'debit',
          category: 'groceries',
          description: 'Weekly grocery shopping at Whole Foods',
          userId: demoUserId,
          profileId: demoProfileId,
          appScope: 'finance',
          accountId: checkingAccount?.id,
          transactionDate: new Date('2026-01-20T14:30:00Z'),
          isRecurring: false,
        },
        {
          amount: 45.00,
          type: 'debit',
          category: 'utilities',
          description: 'Electric bill',
          userId: demoUserId,
          profileId: demoProfileId,
          appScope: 'finance',
          accountId: checkingAccount?.id,
          transactionDate: new Date('2026-01-05T09:00:00Z'),
          reference: 'ELEC-JAN',
          isRecurring: true,
        },
        {
          amount: 55.00,
          type: 'debit',
          category: 'utilities',
          description: 'Internet service',
          userId: demoUserId,
          profileId: demoProfileId,
          appScope: 'finance',
          accountId: checkingAccount?.id,
          transactionDate: new Date('2026-01-03T11:00:00Z'),
          reference: 'ISP-JAN',
          isRecurring: true,
        },
        {
          amount: 150.00,
          type: 'debit',
          category: 'insurance',
          description: 'Car insurance premium',
          userId: demoUserId,
          profileId: demoProfileId,
          appScope: 'finance',
          accountId: checkingAccount?.id,
          transactionDate: new Date('2026-01-10T08:00:00Z'),
          reference: 'AUTO-INS-JAN',
          isRecurring: true,
        },
        {
          amount: 32.50,
          type: 'debit',
          category: 'dining',
          description: 'Lunch at local restaurant',
          userId: demoUserId,
          profileId: demoProfileId,
          appScope: 'finance',
          accountId: checkingAccount?.id,
          transactionDate: new Date('2026-01-18T12:15:00Z'),
          isRecurring: false,
        },
        {
          amount: 75.00,
          type: 'debit',
          category: 'transportation',
          description: 'Gas station fill-up',
          userId: demoUserId,
          profileId: demoProfileId,
          appScope: 'finance',
          accountId: checkingAccount?.id,
          transactionDate: new Date('2026-01-12T17:00:00Z'),
          isRecurring: false,
        },

        // Credit card transactions
        {
          amount: 120.00,
          type: 'debit',
          category: 'shopping',
          description: 'Amazon purchase - electronics',
          userId: demoUserId,
          profileId: demoProfileId,
          appScope: 'finance',
          accountId: creditAccount?.id,
          transactionDate: new Date('2026-01-08T20:30:00Z'),
          isRecurring: false,
        },
        {
          amount: 65.00,
          type: 'debit',
          category: 'entertainment',
          description: 'Movie tickets and snacks',
          userId: demoUserId,
          profileId: demoProfileId,
          appScope: 'finance',
          accountId: creditAccount?.id,
          transactionDate: new Date('2026-01-14T19:00:00Z'),
          isRecurring: false,
        },
        {
          amount: 15.99,
          type: 'debit',
          category: 'subscriptions',
          description: 'Netflix monthly subscription',
          userId: demoUserId,
          profileId: demoProfileId,
          appScope: 'finance',
          accountId: creditAccount?.id,
          transactionDate: new Date('2026-01-01T00:01:00Z'),
          isRecurring: true,
        },

        // Savings account transactions
        {
          amount: 500.00,
          type: 'credit',
          category: 'savings',
          description: 'Monthly savings transfer',
          userId: demoUserId,
          profileId: demoProfileId,
          appScope: 'finance',
          accountId: savingsAccount?.id,
          transactionDate: new Date('2026-01-15T12:00:00Z'),
          isRecurring: true,
        },
        {
          amount: 2.15,
          type: 'credit',
          category: 'interest',
          description: 'Monthly interest payment',
          userId: demoUserId,
          profileId: demoProfileId,
          appScope: 'finance',
          accountId: savingsAccount?.id,
          transactionDate: new Date('2026-01-31T23:59:00Z'),
          isRecurring: true,
        },

        // Business account transactions
        {
          amount: 2500.00,
          type: 'credit',
          category: 'income',
          description: 'Client payment - Project Alpha',
          userId: demoUserId,
          profileId: demoProfileId,
          appScope: 'finance',
          accountId: businessAccount?.id,
          transactionDate: new Date('2026-01-10T14:00:00Z'),
          reference: 'INV-2026-001',
          isRecurring: false,
        },
        {
          amount: 450.00,
          type: 'debit',
          category: 'business-expense',
          description: 'Software licenses and tools',
          userId: demoUserId,
          profileId: demoProfileId,
          appScope: 'finance',
          accountId: businessAccount?.id,
          transactionDate: new Date('2026-01-05T10:00:00Z'),
          isRecurring: false,
        },
        {
          amount: 200.00,
          type: 'debit',
          category: 'business-expense',
          description: 'Marketing and advertising',
          userId: demoUserId,
          profileId: demoProfileId,
          appScope: 'finance',
          accountId: businessAccount?.id,
          transactionDate: new Date('2026-01-12T11:00:00Z'),
          isRecurring: false,
        },
      ];

      for (const transactionData of transactions) {
        try {
          if (transactionData.accountId) {
            await transactionService.create(transactionData);
            logger.log(`Created transaction: ${transactionData.description}`);
          }
        } catch (error) {
          logger.warn(`Could not create transaction: ${error.message}`);
        }
      }
    }

    // Create inventory items
    const inventoryItems = [
      {
        name: 'MacBook Pro M3 16"',
        description: 'Laptop computer used for development work',
        quantity: 1,
        unitValue: 3499.00,
        category: 'electronics',
        userId: demoUserId,
        profileId: demoProfileId,
        appScope: 'finance',
        sku: 'APPLE-MBP-M3-16',
        location: 'Home Office',
      },
      {
        name: 'Standing Desk',
        description: 'Electric adjustable height desk',
        quantity: 1,
        unitValue: 650.00,
        category: 'furniture',
        userId: demoUserId,
        profileId: demoProfileId,
        appScope: 'finance',
        sku: 'DESK-STAND-01',
        location: 'Home Office',
      },
      {
        name: 'Herman Miller Aeron Chair',
        description: 'Ergonomic office chair',
        quantity: 1,
        unitValue: 1200.00,
        category: 'furniture',
        userId: demoUserId,
        profileId: demoProfileId,
        appScope: 'finance',
        sku: 'CHAIR-HM-AERON',
        location: 'Home Office',
      },
      {
        name: 'Sony WH-1000XM5 Headphones',
        description: 'Noise-cancelling wireless headphones',
        quantity: 1,
        unitValue: 399.99,
        category: 'electronics',
        userId: demoUserId,
        profileId: demoProfileId,
        appScope: 'finance',
        sku: 'SONY-WH1000XM5',
        location: 'Home Office',
      },
      {
        name: 'LG 27" 4K Monitor',
        description: 'External display for productivity',
        quantity: 2,
        unitValue: 450.00,
        category: 'electronics',
        userId: demoUserId,
        profileId: demoProfileId,
        appScope: 'finance',
        sku: 'LG-27UK850',
        location: 'Home Office',
      },
      {
        name: 'iPhone 15 Pro',
        description: 'Smartphone for communication',
        quantity: 1,
        unitValue: 999.00,
        category: 'electronics',
        userId: demoUserId,
        profileId: demoProfileId,
        appScope: 'finance',
        sku: 'APPLE-IP15PRO',
        location: 'Personal',
      },
      {
        name: 'Vintage Guitar Collection',
        description: 'Collection of 3 vintage guitars',
        quantity: 3,
        unitValue: 1500.00,
        category: 'collectibles',
        userId: demoUserId,
        profileId: demoProfileId,
        appScope: 'finance',
        sku: 'GUITAR-VINTAGE',
        location: 'Home',
      },
      {
        name: 'Camera Equipment',
        description: 'Professional photography gear',
        quantity: 1,
        unitValue: 2200.00,
        category: 'electronics',
        userId: demoUserId,
        profileId: demoProfileId,
        appScope: 'finance',
        sku: 'CAM-PROF-KIT',
        location: 'Storage',
      },
      {
        name: 'Smart Home Hub',
        description: 'Central control for smart home devices',
        quantity: 1,
        unitValue: 150.00,
        category: 'electronics',
        userId: demoUserId,
        profileId: demoProfileId,
        appScope: 'finance',
        sku: 'SMARTHUB-01',
        location: 'Living Room',
      },
      {
        name: 'Library Books Collection',
        description: 'Personal book collection (approx 150 books)',
        quantity: 150,
        unitValue: 15.00,
        category: 'books',
        userId: demoUserId,
        profileId: demoProfileId,
        appScope: 'finance',
        sku: 'BOOKS-LIBRARY',
        location: 'Home Library',
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
    const budgets = [
      {
        name: 'Monthly Groceries Budget',
        category: 'groceries',
        limit: 600.00,
        spent: 85.42,
        period: 'monthly',
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-01-31T23:59:59Z'),
        userId: demoUserId,
        profileId: demoProfileId,
        appScope: 'finance',
        alertOnExceed: true,
      },
      {
        name: 'Dining Out Budget',
        category: 'dining',
        limit: 300.00,
        spent: 32.50,
        period: 'monthly',
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-01-31T23:59:59Z'),
        userId: demoUserId,
        profileId: demoProfileId,
        appScope: 'finance',
        alertOnExceed: true,
      },
      {
        name: 'Entertainment Budget',
        category: 'entertainment',
        limit: 200.00,
        spent: 65.00,
        period: 'monthly',
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-01-31T23:59:59Z'),
        userId: demoUserId,
        profileId: demoProfileId,
        appScope: 'finance',
        alertOnExceed: true,
      },
      {
        name: 'Transportation Budget',
        category: 'transportation',
        limit: 400.00,
        spent: 75.00,
        period: 'monthly',
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-01-31T23:59:59Z'),
        userId: demoUserId,
        profileId: demoProfileId,
        appScope: 'finance',
        alertOnExceed: false,
      },
      {
        name: 'Shopping Budget',
        category: 'shopping',
        limit: 500.00,
        spent: 120.00,
        period: 'monthly',
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-01-31T23:59:59Z'),
        userId: demoUserId,
        profileId: demoProfileId,
        appScope: 'finance',
        alertOnExceed: true,
      },
      {
        name: 'Utilities Budget',
        category: 'utilities',
        limit: 250.00,
        spent: 100.00,
        period: 'monthly',
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-01-31T23:59:59Z'),
        userId: demoUserId,
        profileId: demoProfileId,
        appScope: 'finance',
        alertOnExceed: true,
      },
      {
        name: 'Annual Savings Goal',
        category: 'savings',
        limit: 12000.00,
        spent: 500.00,
        period: 'yearly',
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-12-31T23:59:59Z'),
        userId: demoUserId,
        profileId: demoProfileId,
        appScope: 'finance',
        alertOnExceed: false,
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

    logger.log('Finance seeding completed successfully!');
    logger.log(`Created ${createdAccounts.length} accounts`);
    logger.log(`Created ${transactions.length} transactions`);
    logger.log(`Created ${inventoryItems.length} inventory items`);
    logger.log(`Created ${budgets.length} budgets`);
  } catch (error) {
    logger.error('Error seeding finance data:', error);
    throw error;
  } finally {
    await app.close();
  }
}

bootstrap();
