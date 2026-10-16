import { Check, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import {
  AssetAudienceRestriction,
  AssetType,
  AssetOriginKind,
  StorageStrategy,
} from '@optimistic-tanuki/models';

@Entity()
@Check(
  'CHK_asset_guardian_origin_scope',
  `("originKind" = 'ordinary' AND "originProfileId" IS NULL AND "originAppId" IS NULL) OR ("originKind" = 'guardian-staged' AND "originProfileId"::text = "profileId" AND "originAppId" IN ('client-interface', 'local-hub'))`
)
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

  /** Set only by GUARDIAN_CREATE; generic asset paths always persist ordinary. */
  @Column({ type: 'varchar', default: 'ordinary' })
  originKind: AssetOriginKind;

  /** Immutable target profile and app captured when a staged asset is created. */
  @Column({ type: 'uuid', nullable: true })
  originProfileId: string | null;

  @Column({ type: 'varchar', nullable: true })
  originAppId: string | null;

  /** Monotonic community audiences; removing a content reference never clears these. */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  audienceCommunityIds: string[];

  /** Monotonic, profile-based restrictions inherited from private content. */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  audienceRestrictions: AssetAudienceRestriction[];

  /** Pending assets stay invisible until storage and audit metadata are durable. */
  @Column({ type: 'varchar', default: 'active' })
  lifecycleState: 'pending-upload' | 'active' | 'pending-delete';

  @Column({ type: 'timestamptz', nullable: true })
  lifecycleLeaseUntil: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lifecycleRetryAfter: Date | null;
}
