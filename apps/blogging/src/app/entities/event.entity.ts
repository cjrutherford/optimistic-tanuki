import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

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
}