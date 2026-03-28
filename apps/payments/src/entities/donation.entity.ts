import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('donations')
@Index(['appScope'])
@Index(['appScope', 'userId'])
@Index(['userId'])
@Index(['createdAt'])
export class Donation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  profileId: string;

  @Column({ type: 'varchar' })
  appScope: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'boolean', default: false })
  isRecurring: boolean;

  @Column({ type: 'varchar', nullable: true })
  lemonSqueezyOrderId: string;

  @Column({ type: 'varchar', nullable: true })
  lemonSqueezySubscriptionId: string;

  @Column({ type: 'varchar', nullable: true })
  externalProvider: string;

  @Column({ type: 'varchar', nullable: true })
  externalTransactionId: string;

  @Column({ type: 'varchar', nullable: true })
  externalCustomerId: string;

  @Column({ type: 'varchar', nullable: true })
  externalInvoiceId: string;

  @Column({ type: 'varchar', nullable: true })
  paymentIntentId: string;

  @Column({ type: 'varchar', nullable: true })
  checkoutToken: string;

  @Column({ type: 'varchar', nullable: true })
  checkoutSecretToken: string;

  @Column({ type: 'text', nullable: true })
  refundReason: string;

  @Column({ type: 'timestamp', nullable: true })
  refundedAt: Date;

  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded';

  @Column({ type: 'varchar', nullable: true })
  currency: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;
}
