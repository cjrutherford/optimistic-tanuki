import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CampaignLifecycleStatus } from '@optimistic-tanuki/models';

@Entity('advertising_campaigns')
@Index(['businessPageId'])
@Index(['userId'])
export class AdvertisingCampaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  businessPageId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', default: 'draft' })
  status: CampaignLifecycleStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  budget: number | null;

  @Column({ type: 'timestamp' })
  startsAt: Date;

  @Column({ type: 'timestamp' })
  endsAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
