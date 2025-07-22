import { Column, Entity, ManyToOne, OneToOne, PrimaryGeneratedColumn } from "typeorm";

import { Project } from "./project.entity";
import { Timer } from "./timer.entity"; // Assuming Timer is another entity in your project

@Entity()
export class Task {
   @PrimaryGeneratedColumn("uuid")
   id: string;

   @Column()
   title: string;

   @Column()
   description: string;

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

   @OneToOne(() => Timer, (timer) => timer.task)
   timer: Timer;

   @ManyToOne(() => Project, (project) => project.tasks)
    project: Project; // manual reference to the Project Entity from the [Project Planning Service]
}
