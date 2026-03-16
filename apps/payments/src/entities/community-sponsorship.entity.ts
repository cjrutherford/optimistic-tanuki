import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type SponsorshipType = 'sticky-ad' | 'banner' | 'featured';

@Entity('community_sponsorships')
@Index(['communityId'])
@Index(['userId'])
@Index(['businessPageId'])
export class CommunitySponsorship {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  communityId: string;

  @Column({ type: 'uuid', nullable: true })
  businessPageId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar' })
  type: SponsorshipType;

  @Column({ type: 'text', nullable: true })
  adContent: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', nullable: true })
  lemonSqueezyOrderId: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'active' | 'expired' | 'cancelled';

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp' })
  startsAt: Date;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'int', default: 1 })
  months: number;
}
