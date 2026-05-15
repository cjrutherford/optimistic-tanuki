import {
  Column,
  Entity,
  ManyToOne,
  ManyToMany,
  JoinTable,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Thread } from './thread.entity';
import { ForumLink } from './forum-link.entity';

@Entity()
export class ForumPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  content: string;

  @Column()
  userId: string;

  @Column()
  profileId: string;

  @Column({ type: 'varchar', default: 'forum' })
  appScope: string;

  @ManyToOne(() => Thread, (thread) => thread.posts)
  thread: Thread;

  @Column()
  threadId: string;

  @ManyToMany(() => ForumLink, (link) => link.posts, { cascade: true })
  @JoinTable()
  links: ForumLink[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @Column({ type: 'boolean', default: false })
  isEdited: boolean;

  @Column({ type: 'varchar', default: 'visible' })
  moderationStatus: 'visible' | 'hidden';

  @Column({ type: 'varchar', nullable: true })
  moderationNotes?: string | null;

  @Column({ type: 'varchar', nullable: true })
  moderatedBy?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  moderatedAt?: Date | null;
}
