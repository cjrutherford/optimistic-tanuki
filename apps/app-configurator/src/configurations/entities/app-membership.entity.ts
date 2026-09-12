import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  WORKSPACE_APP_MEMBERSHIP_ROLES,
  type WorkspaceAppMembershipRole,
} from '@optimistic-tanuki/models';
import { AppInstanceEntity } from './app-instance.entity';

/** Request-only apps retain a terminal denial instead of erasing the request. */
export const APP_MEMBERSHIP_STATUSES = [
  'pending',
  'active',
  'denied',
  'suspended',
  'revoked',
] as const;
export type AppMembershipStatus = (typeof APP_MEMBERSHIP_STATUSES)[number];

@Entity('app_memberships')
@Index(['appInstanceId', 'profileId'], { unique: true })
export class AppMembershipEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'uuid' })
  appInstanceId: string;

  @ManyToOne(() => AppInstanceEntity)
  @JoinColumn([
    { name: 'appInstanceId', referencedColumnName: 'id' },
    { name: 'workspaceId', referencedColumnName: 'workspaceId' },
    { name: 'appScope', referencedColumnName: 'appScope' },
  ])
  appInstance: AppInstanceEntity;

  @Column({ type: 'varchar', length: 128 })
  appScope: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  profileId: string;

  @Column({
    type: 'enum',
    enum: [...WORKSPACE_APP_MEMBERSHIP_ROLES],
    default: 'member',
  })
  role: WorkspaceAppMembershipRole;

  @Column({
    type: 'enum',
    enum: [...APP_MEMBERSHIP_STATUSES],
    default: 'pending',
  })
  status: AppMembershipStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
