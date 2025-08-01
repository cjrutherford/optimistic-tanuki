import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { Change } from './change.entity';
import { ProjectJournal } from './project-journal.entity';
import { Risk } from './risk.entity';
import { Task } from './task.entity';

@Entity()
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  owner: string; // manual reference to the User Profile Entity from the [Profile Service] represneting owner of the project


  @Column({ type: 'text', array: true })
  members: string[]; // manual reference to the User Profile Entity from the [Profile Service] representing a related party to the project

  @Column()
  name: string;

  @Column()
  description: string;

  @Column()
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate?: Date;

  @Column()
  status: string;

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

  @OneToMany(() => Task, (task) => task.project)
  tasks: Task[];

  @OneToMany(() => Risk, (risk) => risk.project)
  risks: Risk[];

  @OneToMany(() => Change, (change) => change.project)
  changes: Change[];

  @OneToMany(() => ProjectJournal, journal => journal.project)
  journalEntries: ProjectJournal[];

}
