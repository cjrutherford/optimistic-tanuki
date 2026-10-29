import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'guardian_profile_activity' })
@Index('IDX_guardian_profile_activity_created_at', ['createdAt'])
export class GuardianProfileActivity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  actorUserId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  dependentUserId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  profileId!: string | null;

  @Column({ type: 'varchar', length: 64 })
  appId!: string;

  @Column({ type: 'varchar', length: 32 })
  operation!: 'profile.view' | 'profile.manage';

  @Column({ type: 'text', array: true, default: '{}' })
  changedFieldNames!: string[];

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
