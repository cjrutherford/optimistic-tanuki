import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('classified_payments')
@Index(['appScope'])
@Index(['appScope', 'buyerId'])
@Index(['appScope', 'sellerId'])
@Index(['appScope', 'classifiedId'])
@Index(['buyerId'])
@Index(['sellerId'])
@Index(['classifiedId'])
@Index(['interestedBuyerId'])
export class ClassifiedPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  classifiedId: string;

  @Column({ type: 'uuid' })
  buyerId: string;

  @Column({ type: 'uuid', nullable: true })
  sellerId: string;

  @Column({ type: 'uuid', nullable: true })
  interestedBuyerId: string;

  @Column({ type: 'varchar' })
  appScope: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  platformFeeAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  sellerReceivesAmount: number;

  @Column({ type: 'uuid', nullable: true })
  offerId: string;

  @Column({ type: 'varchar', nullable: true })
  paymentIntentId: string;

  @Column({
    type: 'varchar',
    default: 'card',
  })
  paymentMethod: 'card' | 'cash-app' | 'venmo' | 'zelle' | 'cash';

  @Column({ type: 'varchar', default: 'pending' })
  status:
    | 'pending'
    | 'confirmed'
    | 'released'
    | 'disputed'
    | 'cancelled'
    | 'refunded';

  @Column({ type: 'varchar', nullable: true })
  proofImageUrl: string;

  @Column({ type: 'text', nullable: true })
  disputeReason: string;

  @Column({ type: 'uuid', nullable: true })
  LemonSqueezyOrderId: string;

  @Column({ type: 'varchar', nullable: true })
  externalProvider: string;

  @Column({ type: 'varchar', nullable: true })
  externalTransactionId: string;

  @Column({ type: 'varchar', nullable: true })
  externalCustomerId: string;

  @Column({ type: 'varchar', nullable: true })
  externalInvoiceId: string;

  @Column({ type: 'varchar', nullable: true })
  checkoutToken: string;

  @Column({ type: 'varchar', nullable: true })
  checkoutSecretToken: string;

  @Column({ type: 'text', nullable: true })
  refundReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  releasedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  refundedAt: Date;
}
