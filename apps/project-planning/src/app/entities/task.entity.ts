import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TaskPriority, TaskStatus } from '@optimistic-tanuki/models';

import { Project } from './project.entity';
import { TaskTag } from './task-tag.entity';
import { TaskTimeEntry } from './task-time-entry.entity';
import { Timer } from './timer.entity'; // Assuming Timer is another entity in your project

@Entity()
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  description: string;

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.TODO })
  status: TaskStatus;

  @Column({ type: 'enum', enum: TaskPriority, default: TaskPriority.MEDIUM })
  priority: TaskPriority;

  @Column()
  createdBy: string;

  @Column()
  createdAt: Date;

  @OneToOne(() => Timer, (timer) => timer.task)
  timer: Timer;

  @ManyToOne(() => Project, (project) => project.tasks)
  project: Project; // manual reference to the Project Entity from the [Project Planning Service]

  @OneToMany(() => TaskTimeEntry, (timeEntry) => timeEntry.task)
  timeEntries: TaskTimeEntry[];

  @ManyToMany(() => TaskTag, (tag) => tag.tasks)
  @JoinTable({
    name: 'task_tags',
    joinColumn: { name: 'task_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: TaskTag[];

  @Column()
  updatedBy: string;

  @Column()
  updatedAt: Date;

  @Column({ nullable: true })
  deletedBy?: string;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date;
}
