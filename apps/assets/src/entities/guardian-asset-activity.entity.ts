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
  @Column({ type: 'varchar', nullable: true }) actorUserId!: string | null;
  @Column({ type: 'varchar', nullable: true }) dependentUserId!: string | null;
  @Column({ type: 'varchar', nullable: true }) profileId!: string | null;
  @Column({ type: 'varchar', nullable: true }) assetId!: string | null;
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
