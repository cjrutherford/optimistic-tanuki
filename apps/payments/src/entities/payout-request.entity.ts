import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type PayoutStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'rejected'
  | 'cancelled';

@Entity('payout_requests')
@Index(['sellerId'])
@Index(['status'])
export class PayoutRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  sellerId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', default: 'pending' })
  status: PayoutStatus;

  @Column({ type: 'varchar' })
  payoutMethod: 'paypal' | 'bank-transfer' | 'venmo' | 'zelle';

  @Column({ type: 'varchar', nullable: true })
  payoutEmail: string;

  @Column({ type: 'varchar', nullable: true })
  bankAccountLast4: string;

  @Column({ type: 'varchar', nullable: true })
  bankRoutingLast4: string;

  @Column({ type: 'varchar', nullable: true })
  transactionId: string;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ type: 'uuid', nullable: true })
  processedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date;
}
