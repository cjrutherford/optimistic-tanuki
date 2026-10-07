import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import {
  AssetAudienceRestriction,
  AssetType,
  StorageStrategy,
} from '@optimistic-tanuki/models';

@Entity()
export default class AssetEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: AssetType, default: AssetType.IMAGE })
  type: AssetType;

  @Column({
    type: 'enum',
    enum: StorageStrategy,
    default: StorageStrategy.LOCAL_BLOCK_STORAGE,
  })
  storageStrategy: StorageStrategy;

  @Column()
  storagePath: string;

  @Column()
  profileId: string;

  /** Monotonic community audiences; removing a content reference never clears these. */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  audienceCommunityIds: string[];

  /** Monotonic, profile-based restrictions inherited from private content. */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  audienceRestrictions: AssetAudienceRestriction[];
}
