import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Blog } from "./blog.entity";

@Entity()
export class Event {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;
    
    @Column()
    description: string; // this will be HTML text-only content.

    @Column()
    location: string;

    @Column('timestamptz')
    startTime: Date;

    @Column('timestamptz')
    endTime: Date;

    @Column()
    organizerId: string;

    @Column({ default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @Column({ default: () => 'CURRENT_TIMESTAMP' })
    updatedAt: Date;

    @ManyToOne(() => Blog, blog => blog.events)
    blog: Blog;
}