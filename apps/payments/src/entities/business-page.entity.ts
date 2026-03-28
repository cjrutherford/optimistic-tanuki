import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type BusinessTier = 'basic' | 'pro' | 'enterprise';
export type FeaturedSpotType =
  | 'hero'
  | 'featured-carousel'
  | 'sidebar'
  | 'top-list'
  | null;

@Entity('business_pages')
@Index(['appScope', 'communityId'], { unique: true })
@Index(['appScope'])
@Index(['ownerId'])
export class BusinessPage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  appScope: string;

  @Column({ type: 'uuid' })
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

  @Column({ type: 'varchar', nullable: true })
  stripeSubscriptionId: string;

  @Column({ type: 'varchar', nullable: true })
  stripeCustomerId: string;

  @Column({ type: 'varchar', nullable: true })
  externalProvider: string;

  @Column({ type: 'varchar', nullable: true })
  paymentIntentId: string;

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

  @Column({ type: 'boolean', default: false })
  isFeatured: boolean;

  @Column({ type: 'varchar', nullable: true })
  featuredSpotType: FeaturedSpotType;

  @Column({ type: 'text', nullable: true })
  customSpotContent: string;

  @Column({ type: 'varchar', nullable: true })
  customSpotImageUrl: string;

  @Column({ type: 'varchar', nullable: true })
  customSpotGradient: string;

  @Column({ type: 'uuid', nullable: true })
  businessThemeId: string;
}
