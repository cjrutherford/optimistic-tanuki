import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'guardian_content_audit' })
@Index('IDX_guardian_content_audit_created_at', ['createdAt'])
export class GuardianContentAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Column({ type: 'uuid', nullable: true })
  dependentUserId: string | null;

  @Column({ type: 'uuid', nullable: true })
  dependentProfileId: string | null;

  @Column({ type: 'varchar' })
  appId: string;

  @Column({ type: 'varchar' })
  resourceType: 'post' | 'comment';

  @Column({ type: 'uuid', nullable: true })
  resourceId: string | null;

  @Column({ type: 'varchar' })
  operation: string;

  @Column({ type: 'simple-json' })
  changedFields: string[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
