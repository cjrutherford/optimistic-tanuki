import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CampaignPlacementType } from '@optimistic-tanuki/models';

@Entity('advertising_campaign_creatives')
@Index(['campaignId', 'placementType'], { unique: true })
export class AdvertisingCampaignCreative {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  campaignId: string;

  @Column({ type: 'varchar' })
  placementType: CampaignPlacementType;

  @Column({ type: 'varchar', nullable: true })
  headline: string | null;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ type: 'varchar', nullable: true })
  ctaLabel: string | null;

  @Column({ type: 'varchar', nullable: true })
  ctaUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  mediaUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  imageUrl: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
