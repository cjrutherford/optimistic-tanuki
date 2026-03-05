import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { Post } from './post.entity';

@Entity()
export class Poll {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  question: string;

  @Column('simple-array')
  options: string[];

  @Column('simple-array', { nullable: true })
  votes: string[];

  @Column({ default: false })
  isMultipleChoice: boolean;

  @Column({ nullable: true })
  endsAt: Date;

  @Column({ default: true })
  showResultsBeforeVote: boolean;

  @Column({ default: false })
  isAnonymous: boolean;

  @Column()
  profileId: string;

  @Column()
  userId: string;

  @Column({ default: false })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @OneToOne(() => Post, (post) => post.poll)
  post: Post;
}
