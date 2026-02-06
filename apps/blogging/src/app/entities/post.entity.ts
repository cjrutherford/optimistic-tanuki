import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';
import { Blog } from './blog.entity';
import { BlogComponent } from './blog-component.entity';

@Entity()
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  content: string; // this will be HTML text-only content.

  @Column()
  authorId: string;

  @Column({ type: 'varchar', default: 'blogging' })
  appScope: string;

  @Column({ default: true })
  isDraft: boolean;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  @ManyToOne(() => Blog, (blog) => blog.posts)
  blog: Blog;

  @OneToMany(() => BlogComponent, (component) => component.post, { cascade: true })
  components: BlogComponent[];

  @Column({ default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
