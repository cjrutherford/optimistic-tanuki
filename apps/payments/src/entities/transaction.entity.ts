import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type TransactionType =
  | 'donation'
  | 'classified_payment'
  | 'business_subscription'
  | 'sponsorship'
  | 'refund'
  | 'payout';
export type TransactionDirection = 'incoming' | 'outgoing';

@Entity('payment_events')
@Index(['userId'])
@Index(['createdAt'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar' })
  type: TransactionType;

  @Column({ type: 'varchar' })
  direction: TransactionDirection;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  platformFee: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  netAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 5 })
  feePercentage: number;

  @Column({ type: 'varchar', nullable: true })
  currency: string;

  @Column({ type: 'uuid', nullable: true })
  referenceId: string;

  // E3: reference to the finance ledger row posted for this event.
  // Written when finance acknowledges the posting; null until then.
  @Column({ type: 'uuid', nullable: true })
  financeTransactionId: string | null;

  @Column({ type: 'varchar', default: 'completed' })
  status: 'pending' | 'completed' | 'failed' | 'refunded';

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;
}
