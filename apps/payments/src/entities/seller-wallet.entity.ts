import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type SellerStripeAccountStatus =
  | 'not-connected'
  | 'pending'
  | 'restricted'
  | 'enabled';

@Entity('seller_wallets')
@Index(['appScope', 'sellerId'], { unique: true })
export class SellerWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  appScope: string;

  @Column({ type: 'uuid' })
  sellerId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  availableBalance: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  pendingBalance: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalEarned: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalPaidOut: number;

  @Column({ type: 'varchar', nullable: true })
  payoutMethod: 'paypal' | 'bank-transfer' | 'venmo' | 'zelle' | null;

  @Column({ type: 'varchar', nullable: true })
  payoutEmail: string;

  @Column({ type: 'varchar', nullable: true })
  bankAccountLast4: string;

  @Column({ type: 'varchar', nullable: true })
  bankRoutingLast4: string;

  @Column({ type: 'varchar', nullable: true })
  stripeAccountId: string;

  @Column({ type: 'varchar', default: 'not-connected' })
  stripeAccountStatus: SellerStripeAccountStatus;

  @Column({ type: 'boolean', default: false })
  stripeDetailsSubmitted: boolean;

  @Column({ type: 'boolean', default: false })
  stripeChargesEnabled: boolean;

  @Column({ type: 'boolean', default: false })
  stripePayoutsEnabled: boolean;

  @Column({ type: 'timestamp', nullable: true })
  stripeOnboardingCompletedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  stripeLastSyncedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastPayoutAt: Date;
}
