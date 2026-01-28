import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Topic } from './topic.entity';
import { ForumPost } from './forum-post.entity';

@Entity()
export class Thread {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  description: string;

  @Column()
  content: string;

  @Column()
  userId: string;

  @Column()
  profileId: string;

  @Column({ type: 'varchar', default: 'forum' })
  appScope: string;

  @ManyToOne(() => Topic, (topic) => topic.threads)
  topic: Topic;

  @Column()
  topicId: string;

  @OneToMany(() => ForumPost, (post) => post.thread)
  posts: ForumPost[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @Column({ type: 'varchar', default: 'public' })
  visibility: 'public' | 'private';

  @Column({ type: 'boolean', default: false })
  isPinned: boolean;

  @Column({ type: 'boolean', default: false })
  isLocked: boolean;

  @Column({ type: 'int', default: 0 })
  viewCount: number;
}
