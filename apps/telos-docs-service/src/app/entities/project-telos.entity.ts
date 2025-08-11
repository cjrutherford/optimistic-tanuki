import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { ProfileTelos } from ".";

@Entity()
export class ProjectTelos {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => ProfileTelos, (profile) => profile.projects)
    profile: ProfileTelos;

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

    @Column()
    overallProjectSummary: string;
}