import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type BusinessTier = 'basic' | 'pro' | 'enterprise';

@Entity('business_pages')
@Index(['communityId'], { unique: true })
@Index(['ownerId'])
export class BusinessPage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  communityId: string;

  @Column({ type: 'uuid' })
  ownerId: string;

  @Column({ type: 'varchar', nullable: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', nullable: true })
  logoUrl: string;

  @Column({ type: 'varchar', nullable: true })
  website: string;

  @Column({ type: 'varchar', nullable: true })
  phone: string;

  @Column({ type: 'varchar', nullable: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'varchar', default: 'basic' })
  tier: BusinessTier;

  @Column({ type: 'varchar', nullable: true })
  lemonSqueezySubscriptionId: string;

  @Column({ type: 'varchar', default: 'inactive' })
  subscriptionStatus: 'active' | 'inactive' | 'cancelled' | 'past_due';

  @Column({ type: 'uuid', nullable: true })
  pinnedPostId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  subscriptionExpiresAt: Date;

  @Column({ type: 'boolean', default: false })
  isCommunity: boolean;
}
