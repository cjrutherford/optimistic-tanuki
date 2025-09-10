import { Column, Entity, OneToOne, PrimaryGeneratedColumn } from "typeorm";

import { Task } from "./task.entity";

/**
 * Timer Entity.
 * 
 * Timers start in a stopped state with 0s elapsed.
 * When a timer is started, it transitions to the started state and records the start time.
 * When a timer is paused, it transitions to the paused state and records the elapsed time.
 * When a timer is stopped, it transitions to the stopped state, records the end time,
 * and updates the elapsed time to the total time spent.
 */


@Entity()
export class Timer {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: 'enum', enum: ['STARTED', 'PAUSED', 'STOPPED'], default: 'STOPPED' })
    status: 'STARTED' | 'PAUSED' | 'STOPPED';

    @Column()
    startTime: Date;

    @Column({ nullable: true })
    endTime?: Date; // Nullable to allow for ongoing timers

    @Column({ default: 0 })
    elapsedTime: number; // Store elapsed time in seconds

    @OneToOne(type => Task, task => task.timer, { onDelete: 'CASCADE' })
    task: Task;

    @Column()
    updatedBy: string;

    @Column()
    updatedAt: Date;

    @Column({ nullable: true })
    deletedBy?: string;

    @Column({ type: 'timestamp', nullable: true })
    deletedAt?: Date;
}
