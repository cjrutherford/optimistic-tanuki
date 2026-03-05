import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class PostShare {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  originalPostId: string;

  @Column()
  sharedById: string;

  @Column({ nullable: true })
  comment: string;

  @Column({ default: 'public' })
  visibility: 'public' | 'followers' | 'community';

  @Column({ nullable: true })
  communityId: string;

  @CreateDateColumn()
  createdAt: Date;
}
