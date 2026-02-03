import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
} from 'typeorm';
import { Account } from './account.entity';

@Entity()
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column()
  type: string; // 'credit' or 'debit'

  @Column()
  category: string; // 'food', 'transport', 'salary', 'utilities', etc.

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  userId: string;

  @Column()
  profileId: string;

  @Column({ type: 'varchar', default: 'finance' })
  appScope: string;

  @Column()
  accountId: string;

  @ManyToOne(() => Account, (account) => account.transactions)
  @JoinColumn({ name: 'accountId' })
  account: Account;

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
}
