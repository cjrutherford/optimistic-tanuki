import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'guardian_content_audit' })
@Index('IDX_guardian_content_audit_created_at', ['createdAt'])
export class GuardianContentAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  actorUserId: string;

  @Column({ type: 'uuid' })
  dependentUserId: string;

  @Column({ type: 'uuid' })
  dependentProfileId: string;

  @Column({ type: 'varchar' })
  appId: string;

  @Column({ type: 'varchar' })
  resourceType: 'post' | 'comment';

  @Column({ type: 'uuid' })
  resourceId: string;

  @Column({ type: 'varchar' })
  operation: string;

  @Column({ type: 'simple-json' })
  changedFields: string[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
