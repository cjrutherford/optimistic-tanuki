import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('seller_wallets')
@Index(['sellerId'], { unique: true })
export class SellerWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
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

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastPayoutAt: Date;
}
