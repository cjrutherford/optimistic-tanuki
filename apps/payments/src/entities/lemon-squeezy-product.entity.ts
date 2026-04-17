import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type LemonSqueezyTier =
  | 'basic'
  | 'pro'
  | 'enterprise'
  | 'donation-one-time'
  | 'donation-recurring'
  | 'classified-fee';

@Entity('lemon_squeezy_products')
@Index(['appScope', 'tier'], { unique: true })
@Index(['lemonSqueezyProductId'])
export class LemonSqueezyProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  appScope: string;

  @Column({ type: 'varchar' })
  tier: LemonSqueezyTier;

  @Column({ type: 'varchar' })
  lemonSqueezyProductId: string;

  @Column({ type: 'varchar', nullable: true })
  lemonSqueezyVariantId: string;

  @Column({ type: 'varchar', nullable: true })
  name: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
