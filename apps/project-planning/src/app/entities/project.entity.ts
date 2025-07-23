import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { Change } from './change.entity';
import { Risk } from './risk.entity';
import { Task } from './task.entity';
import { ProjectJournal } from './project-journal.entity';

@Entity()
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  owner: string; // manual reference to the User Profile Entity from the [Profile Service] represneting owner of the project


  @Column({ type: 'array', default: [] })
  members: string[]; // manual reference to the User Profile Entity from the [Profile Service] representing a related party to the project

  @Column()
  name: string;

  @Column()
  description: string;

  @Column()
  startDate: Date;

  @Column()
  endDate: Date;

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

  @Column()
  deletedBy: string;

  @Column()
  deletedAt: Date;

  @OneToMany(() => Task, (task) => task.project)
  tasks: Task[];

  @OneToMany(() => Risk, (risk) => risk.project)
  risks: Risk[];

  @OneToMany(() => Change, (change) => change.project)
  changes: Change[];

  @OneToMany(() => ProjectJournal, journal => journal.project)
  journalEntries: ProjectJournal[];

}
