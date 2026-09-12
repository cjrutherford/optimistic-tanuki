import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  WORKSPACE_APP_LIFECYCLE_STATES,
  type WorkspaceAppLifecycleState,
} from '@optimistic-tanuki/models';

@Entity('app_instances')
@Index(['workspaceId'], { unique: true })
@Index(['id', 'workspaceId', 'appScope'], { unique: true })
export class AppInstanceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'varchar', length: 128 })
  appScope: string;

  @Column({ type: 'uuid' })
  ownerUserId: string;

  @Column({ type: 'uuid' })
  ownerProfileId: string;

  @Column({
    type: 'enum',
    enum: [...WORKSPACE_APP_LIFECYCLE_STATES],
    default: 'pending',
  })
  status: WorkspaceAppLifecycleState;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
