import { Column, Entity, ManyToOne, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import {TaskPriority, TaskStatus} from "@optimistic-tanuki/models";

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

    @Column({ type: "enum", enum: TaskStatus, default: TaskStatus.TODO })
    status: TaskStatus;

    @Column({ type: "enum", enum: TaskPriority, default: TaskPriority.MEDIUM })
    priority: TaskPriority;

    @Column()
    createdBy: string;

    @Column()
    createdAt: Date;

    @OneToOne(() => Timer, (timer) => timer.task)
    timer: Timer;

    @ManyToOne(() => Project, (project) => project.tasks)
    project: Project; // manual reference to the Project Entity from the [Project Planning Service]

    @Column()
    updatedBy: string;

    @Column()
    updatedAt: Date;

    @Column({ nullable: true })
    deletedBy?: string;

    @Column({ type: 'timestamp', nullable: true })
    deletedAt?: Date;
}
