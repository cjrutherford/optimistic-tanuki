import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Task } from './task.entity';

/**
 * TaskTimeEntry Entity.
 *
 * Represents a time tracking session for a task.
 * Supports multiple time entries per task for detailed tracking.
 * Each entry captures a start time, optional end time, and elapsed duration.
 */
@Entity()
export class TaskTimeEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Task, (task) => task.timeEntries, { onDelete: 'CASCADE' })
  task: Task;

  @Column()
  startTime: Date;

  @Column({ nullable: true })
  endTime?: Date;

  @Column({ default: 0 })
  elapsedSeconds: number;

  @Column({ type: 'text', nullable: true })
  description?: string;

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
