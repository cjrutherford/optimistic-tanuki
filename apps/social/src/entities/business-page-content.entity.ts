import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Community business-page CONTENT (O13/E14 target, decided: row-move with
 * dual-write). Money state (`lemonSqueezy*`, expiry) stays on the payments
 * row until O14; `tier`/`subscriptionStatus` mirror here for display.
 * Backfilled empty (0 rows verified); gateway dual-writes on create.
 */
@Entity('business_page_contents')
@Index(['communityId'], { unique: true })
@Index(['ownerId'])
export class BusinessPageContent {
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
  tier: string;

  @Column({ type: 'varchar', default: 'inactive' })
  subscriptionStatus: string;

  @Column({ type: 'uuid', nullable: true })
  pinnedPostId: string;

  @Column({ type: 'boolean', default: false })
  isCommunity: boolean;

  @Column({ type: 'boolean', default: false })
  isFeatured: boolean;

  @Column({ type: 'uuid', nullable: true })
  paymentsBusinessPageId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
