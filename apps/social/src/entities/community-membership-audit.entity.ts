import {
  CreateDateColumn,
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  MembershipLifecycleAction,
  MembershipLifecycleActor,
  MembershipLifecycleState,
} from '@optimistic-tanuki/models';

@Entity()
@Index(['workspaceId', 'subjectId', 'createdAt'])
export class CommunityMembershipAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  workspaceId: string | null;

  @Column({ type: 'varchar', nullable: true })
  subjectId: string | null;

  @Column({ type: 'varchar', nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar' })
  actor: MembershipLifecycleActor;

  @Column({ type: 'varchar' })
  action: MembershipLifecycleAction;

  @Column({ type: 'varchar' })
  from: MembershipLifecycleState;

  @Column({ type: 'varchar' })
  to: MembershipLifecycleState;

  @CreateDateColumn()
  createdAt: Date;
}
