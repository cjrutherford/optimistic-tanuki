import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  CampaignPlacementType,
  CampaignTargetType,
} from '@optimistic-tanuki/models';

@Entity('advertising_campaign_target_placements')
@Index(['campaignId', 'targetType', 'targetId', 'placementType'], {
  unique: true,
})
@Index(['targetType', 'targetId', 'placementType'])
export class AdvertisingCampaignTargetPlacement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  campaignId: string;

  @Column({ type: 'varchar' })
  targetType: CampaignTargetType;

  @Column({ type: 'uuid' })
  targetId: string;

  @Column({ type: 'varchar' })
  placementType: CampaignPlacementType;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
