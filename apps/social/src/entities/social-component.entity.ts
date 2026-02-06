import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { Post } from './post.entity';

@Entity('social_components')
@Index(['postId', 'instanceId'], { unique: true }) // Ensure unique instance per post
export class SocialComponent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  postId: string;

  @Column({ type: 'varchar', length: 255 })
  instanceId: string;

  @Column({ type: 'varchar', length: 100 })
  componentType: string;

  @Column('jsonb')
  componentData: Record<string, any>;

  @Column('integer')
  position: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Post, post => post.components, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: Post;
}
