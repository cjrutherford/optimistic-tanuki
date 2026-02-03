import { DataSource } from 'typeorm';
import { Account } from '../entities/account.entity';
import { Transaction } from '../entities/transaction.entity';
import { InventoryItem } from '../entities/inventory-item.entity';
import { Budget } from '../entities/budget.entity';

const config = {
  type: 'postgres' as const,
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DB || 'ot_finance',
  entities: [Account, Transaction, InventoryItem, Budget],
  migrations: ['migrations/*.ts'],
  synchronize: false,
  logging: true,
};

export default new DataSource(config);
