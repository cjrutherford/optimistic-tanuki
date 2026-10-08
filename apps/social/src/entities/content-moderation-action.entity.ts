import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class ContentModerationAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  appScope: string;

  @Column({ type: 'varchar', nullable: true })
  workspaceId: string | null;

  @Column({ type: 'varchar' })
  action: 'report_status' | 'content_moderation';

  @Column({ type: 'varchar' })
  subjectType: string;

  @Column({ type: 'varchar' })
  subjectId: string;

  @Column({ type: 'varchar', nullable: true })
  reportId: string | null;

  @Column({ type: 'varchar' })
  actorProfileId: string;

  @Column({ type: 'jsonb' })
  details: Record<string, unknown>;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
