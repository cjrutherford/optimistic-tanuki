import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class ForumModerationAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  appScope: string;

  @Column({ type: 'varchar' })
  action: 'report_status' | 'content_moderation';

  @Column({ type: 'varchar' })
  subjectType: 'thread' | 'post';

  @Column({ type: 'varchar' })
  subjectId: string;

  @Column({ type: 'varchar' })
  actorProfileId: string;

  @Column({ type: 'jsonb' })
  details: Record<string, unknown>;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
