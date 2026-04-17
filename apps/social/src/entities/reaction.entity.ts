/* istanbul ignore file */
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Comment } from './comment.entity';
import { Post } from './post.entity';

@Entity()
export class Reaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  value: number;

  @Column()
  userId: string;

  @Column()
  profileId: string;

  @Column({ type: 'varchar', default: 'social' })
  appScope: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @ManyToOne(() => Post, (post) => post.reactions, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  post?: Post;

  @ManyToOne(() => Comment, (comment) => comment.reactions, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  comment?: Comment;
}
