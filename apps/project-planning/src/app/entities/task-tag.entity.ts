import {
  Column,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Task } from './task.entity';

/**
 * TaskTag Entity.
 *
 * Represents a tag that can be associated with multiple tasks.
 * Tags enable categorization and filtering of tasks.
 */
@Entity()
@Unique(['name'])
export class TaskTag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  color?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @ManyToMany(() => Task, (task) => task.tags)
  tasks: Task[];

  @Column()
  createdBy: string;

  @Column()
  createdAt: Date;

  @Column()
  updatedBy: string;

  @Column()
  updatedAt: Date;

  @Column({ nullable: true })
  deletedBy?: string;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date;
}
