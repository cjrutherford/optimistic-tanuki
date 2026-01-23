import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Task } from './task.entity';

/**
 * TaskNote Entity.
 *
 * Represents a note or journal entry for a task.
 * Similar to ProjectJournal but scoped to individual tasks.
 */
@Entity()
export class TaskNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  profileId: string; // manual connection to the profile entity that wrote the note

  @ManyToOne(() => Task, (task) => task.notes, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  task: Task;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ nullable: true })
  analysis?: string; // AI Analysis of the note, if applicable

  @Column()
  updatedBy: string;

  @Column()
  updatedAt: Date;

  @Column({ nullable: true })
  deletedBy?: string;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date;
}
