import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class PersonaTelos {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column()
    description: string;

    @Column('text', { array: true })
    goals: string[];

    @Column('text', { array: true })
    skills: string[];

    @Column('text', { array: true })
    interests: string[];

    @Column('text', { array: true })
    limitations: string[];

    @Column('text', { array: true })
    strengths: string[];

    @Column('text', { array: true })
    objectives: string[];

    @Column()
    coreObjective: string;

    @Column('text', { array: true })
    exampleResponses: string[];

    @Column()
    promptTemplate: string;
}