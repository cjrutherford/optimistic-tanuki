import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  OneToMany,
} from 'typeorm';
import { Post } from './post.entity';
import { Contact } from './contact.entity';
import { Event } from './event.entity';

@Entity()
@Index(['catalogId'], { unique: true })
export class Blog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column()
  ownerId: string;

  @Column({ type: 'varchar', default: 'blogging' })
  appScope: string;

  @Column({ type: 'uuid', nullable: true })
  workspaceId: string | null;

  @Column({ type: 'uuid', nullable: true })
  catalogId: string | null;

  @Column({ default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @OneToMany(() => Post, (post) => post.blog)
  posts: Post[];

  @OneToMany(() => Contact, (contact) => contact.blog)
  contacts: Contact[];

  @OneToMany(() => Event, (event) => event.blog)
  events: Event[];
}
