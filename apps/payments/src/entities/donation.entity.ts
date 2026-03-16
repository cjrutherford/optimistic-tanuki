import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('donations')
@Index(['userId'])
@Index(['createdAt'])
export class Donation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  profileId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'boolean', default: false })
  isRecurring: boolean;

  @Column({ type: 'varchar', nullable: true })
  lemonSqueezyOrderId: string;

  @Column({ type: 'varchar', nullable: true })
  lemonSqueezySubscriptionId: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'completed' | 'failed' | 'cancelled';

  @Column({ type: 'varchar', nullable: true })
  currency: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date;
}
