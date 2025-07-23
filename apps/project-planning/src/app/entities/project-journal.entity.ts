import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Project } from "./project.entity";

@Entity()
export class ProjectJournal {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    profileId: string; //manual connection to the profile entity that wrote the journal entry

    @ManyToOne(() => Project, project => project.journalEntries, {
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    })
    project: Project;

    @Column({ type: 'text' })
    content: string;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @Column({ nullable: true })
    analysis: string; // AI Analysis of the journal entry, if applicable.
    
    @Column()
    updatedBy: string;
    
    @Column()
    updatedAt: Date;
    
    @Column()
    deletedBy: string;
    
    @Column()
    deletedAt: Date;
}