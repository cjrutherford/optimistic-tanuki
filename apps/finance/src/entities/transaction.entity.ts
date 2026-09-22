import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
} from 'typeorm';
import { Account } from './account.entity';
import {
  BankSyncSourceType,
  BankTransactionReviewStatus,
  FinanceWorkspace,
} from '@optimistic-tanuki/models';
import { FinanceTenant } from './finance-tenant.entity';

@Entity()
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column()
  type: string; // 'credit' or 'debit'

  @Column({ nullable: true })
  category: string; // 'food', 'transport', 'salary', 'utilities', etc.

  @Column({ type: 'text', nullable: true })
  description: string;

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

  @Column('uuid')
  accountId: string;

  @ManyToOne(() => Account, (account) => account.transactions)
  @JoinColumn({ name: 'accountId' })
  account: Account;

  @ManyToOne(() => FinanceTenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: FinanceTenant;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  transactionDate: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @Column({ type: 'varchar', nullable: true })
  reference: string;

  @Column({ type: 'boolean', default: false })
  isRecurring: boolean;

  @Column({ type: 'varchar', nullable: true })
  payeeOrVendor: string;

  @Column({ type: 'varchar', nullable: true })
  transferType: string;

  @Column({ type: 'varchar', default: BankSyncSourceType.MANUAL })
  sourceType: BankSyncSourceType;

  @Column({ type: 'varchar', nullable: true })
  sourceProvider: string | null;

  @Column({ type: 'varchar', nullable: true, unique: false })
  externalTransactionId: string | null;

  @Column({ type: 'boolean', default: false })
  pending: boolean;

  @Column({
    type: 'varchar',
    default: BankTransactionReviewStatus.NEEDS_REVIEW,
  })
  reviewStatus: BankTransactionReviewStatus;

  // E3: posting provenance for ledger rows written from sibling domains
  // (payments/store/billing). Bank-synced rows keep using sourceType/
  // sourceProvider/externalTransactionId; domain postings use these.
  @Column({ type: 'varchar', nullable: true })
  source: string | null;

  @Column({ type: 'uuid', nullable: true })
  sourceId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  providerMeta: Record<string, unknown> | null;
}
