import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class ForumReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  reporterId: string;

  @Column({ type: 'varchar' })
  contentType: 'thread' | 'post';

  @Column()
  contentId: string;

  @Column({ type: 'varchar' })
  reason: string;

  @Column({ type: 'varchar', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed';

  @Column({ type: 'varchar', nullable: true })
  adminNotes?: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
