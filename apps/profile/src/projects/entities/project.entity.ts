import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Profile } from "../../profiles/entities/profile.entity";
import { Timeline } from "../../timelines/entities/timeline.entity";
import { Goal } from "../../goals/entities/goal.entity";

@Entity()
export class Project {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column()
    description: string;

    @Column()
    userId: string;

    @ManyToOne(type => Profile, profile => profile.projects)
    related_profile: Profile;

    @ManyToOne(type => Timeline, project => project.related_project)
    timeLineEvents: Timeline[]; 

    @ManyToOne(type => Goal, project => project.related_project)    
    goals: Goal[]


    @Column({ default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;
}
