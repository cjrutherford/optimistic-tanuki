import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Timeline } from "../../timelines/entities/timeline.entity";
import { Profile } from "../../profiles/entities/profile.entity";
import { Project } from "../../projects/entities/project.entity";

@Entity()
export class Goal {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column()
    description: string;

    @Column()
    target: number;

    @Column()
    progress: number;

    @Column()
    userId: string;

    @Column()
    startDate: Date;

    @Column({ default: null })
    endDate?: Date;

    @Column({ default: false })
    completed: boolean;

    @OneToMany( type => Timeline, timeline => timeline.related_goal)
    timeLineEvents: Timeline[];

    @ManyToOne(type => Profile, profile => profile.goals)
    related_profile: Profile;

    @ManyToOne(type => Project, project => project.goals)
    related_project: Project;

    @Column({ default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;
}


