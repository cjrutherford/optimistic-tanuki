import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
@Index(['createdAt'])
export class GuardianAssetActivity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column() actorUserId!: string;
  @Column() dependentUserId!: string;
  @Column() profileId!: string;
  @Column() assetId!: string;
  @Column() appId!: string;
  @Column({ type: 'varchar' }) operation!:
    | 'upload'
    | 'list'
    | 'read'
    | 'delete';
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  changedFieldNames!: string[];
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
