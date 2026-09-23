import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Sponsorship CONTENT (O13/E14/E15 target, decided: row-move with dual-write).
 * Tiers, ad content, and scheduling live here; charge capture
 * (`lemonSqueezyOrderId`, `amount` settlement) stays payments-side,
 * referenced by id.
 */
@Entity('community_sponsorship_contents')
@Index(['communityId'])
@Index(['userId'])
export class CommunitySponsorshipContent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  communityId: string;

  @Column({ type: 'uuid', nullable: true })
  businessPageId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar' })
  type: string;

  @Column({ type: 'text', nullable: true })
  adContent: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  startsAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({ type: 'int', default: 1 })
  months: number;

  @Column({ type: 'uuid', nullable: true })
  paymentsSponsorshipId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
