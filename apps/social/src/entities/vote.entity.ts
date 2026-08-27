/* istanbul ignore file */
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Comment } from './comment.entity';
import { Post } from './post.entity';

@Entity()
@Index('UQ_vote_post_profile', ['post', 'profileId'], {
  unique: true,
  where: '"postId" IS NOT NULL',
})
@Index('UQ_vote_comment_profile', ['comment', 'profileId'], {
  unique: true,
  where: '"commentId" IS NOT NULL',
})
export class Vote {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  value: number;

  @Column()
  userId: string; // Changed from relation to user ID string

  @Column()
  profileId: string;

  @Column({ type: 'varchar', default: 'social' })
  appScope: string;

  @ManyToOne(() => Post, (post) => post.votes, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  post?: Post;

  @ManyToOne(() => Comment, (comment) => comment.votes, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  comment?: Comment;
}
