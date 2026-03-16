import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('classified_payments')
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

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  releasedAt: Date;
}
