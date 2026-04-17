import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Transaction } from './transaction.entity';
import { FinanceWorkspace } from '@optimistic-tanuki/models';
import { FinanceTenant } from './finance-tenant.entity';
import { BankConnectionStatus } from '@optimistic-tanuki/models';

@Entity()
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  type: string; // 'bank', 'cash', 'credit', 'investment', 'other'

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  balance: number;

  @Column()
  currency: string; // 'USD', 'EUR', etc.

  @Column()
  userId: string;

  @Column()
  profileId: string;

  @Column('uuid')
  tenantId: string;

  @Column({ type: 'varchar', default: 'finance' })
  appScope: string;

  @Column({ type: 'varchar', default: 'personal' })
  workspace: FinanceWorkspace;

  @OneToMany(() => Transaction, (transaction) => transaction.account)
  transactions: Transaction[];

  @ManyToOne(() => FinanceTenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: FinanceTenant;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'timestamp', nullable: true })
  lastReviewedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  providerConnectionId: string | null;

  @Column({ type: 'varchar', nullable: true })
  providerAccountId: string | null;

  @Column({ type: 'varchar', nullable: true })
  institutionName: string | null;

  @Column({ type: 'varchar', nullable: true })
  syncStatus: BankConnectionStatus | null;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt: Date | null;
}
