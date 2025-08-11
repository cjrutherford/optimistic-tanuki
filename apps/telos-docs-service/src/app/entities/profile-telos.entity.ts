import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { ProjectTelos } from ".";

@Entity()
export class ProfileTelos {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @OneToMany(() => ProjectTelos, (project) => project.profile)
    projects: ProjectTelos[];

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
    overallProfileSummary: string;
}