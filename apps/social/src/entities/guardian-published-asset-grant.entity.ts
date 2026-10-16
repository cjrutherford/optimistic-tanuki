import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
@Index(
  'UQ_guardian_published_asset_grant_scope',
  ['assetId', 'resourceType', 'resourceId', 'dependentProfileId', 'appId'],
  { unique: true }
)
export class GuardianPublishedAssetGrant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  assetId: string;

  @Column({ type: 'varchar' })
  resourceType: 'post' | 'comment';

  @Column('uuid')
  resourceId: string;

  @Column('uuid')
  dependentProfileId: string;

  @Column({ type: 'varchar' })
  appId: string;

  @Column('uuid')
  actorUserId: string;

  @CreateDateColumn()
  createdAt: Date;
}
